"""Testa a orquestração shell com Docker simulado, sem acessar um daemon."""
import json
import os
import shutil
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
FAKE_DOCKER = r'''
import json, os, pathlib, sys
a = sys.argv[1:]
with open(os.environ['FAKE_DOCKER_LOG'], 'a') as log:
    log.write(json.dumps(a) + '\n')
if a[:2] == ['image', 'inspect'] and os.environ.get('FAKE_MISSING') == '1':
    sys.exit(1)
if a and a[0] == 'compose':
    if '--images' in a:
        print('opa-chartlink-api:1.0.8\nopa-chartlink-web:1.0.8')
    if 'ps' in a and '--status' in a and os.environ.get('FAKE_RUNNING') == '1':
        print('existing-api')
    if 'run' in a and 'backup' in a and os.environ.get('FAKE_BACKUP_ERROR') == '1':
        sys.exit(1)
if a[:2] == ['image', 'save']:
    pathlib.Path(a[a.index('--output')+1]).write_bytes(b'simulated archive')
'''


class DeployCommandTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.root = Path(self.temp.name)
        self.project = self.root / 'project with spaces'
        (self.project / 'scripts').mkdir(parents=True)
        shutil.copy2(ROOT / 'scripts/chartlink.sh', self.project / 'scripts/chartlink.sh')
        (self.project / '.env').write_text('CHARTLINK_IMAGE_TAG=1.0.8\nCHARTLINK_SECRET_KEY=test-only-secret-key\n')
        for name in ['compose.yaml', 'compose.build.yaml']:
            shutil.copy2(ROOT / name, self.project / name)
        bin_dir = self.root / 'bin'
        bin_dir.mkdir()
        fake = bin_dir / 'docker'
        fake.write_text('#!' + sys.executable + '\n' + FAKE_DOCKER)
        fake.chmod(0o700)
        self.log = self.root / 'calls.jsonl'
        self.env = dict(os.environ, PATH=str(bin_dir)+os.pathsep+os.environ['PATH'],
                        FAKE_DOCKER_LOG=str(self.log), COMPOSE_PROJECT_NAME='unrelated',
                        COMPOSE_FILE='/not-our-project.yaml')

    def tearDown(self):
        self.temp.cleanup()

    def run_command(self, *args):
        return subprocess.run(['sh', str(self.project / 'scripts/chartlink.sh'), *args],
                              cwd=str(self.root), env=self.env, capture_output=True, text=True)

    def calls(self):
        return [json.loads(line) for line in self.log.read_text().splitlines()] if self.log.exists() else []

    def assert_scoped(self):
        for call in self.calls():
            if call[0] == 'compose' and call != ['compose', 'version']:
                self.assertEqual(call[call.index('--project-name')+1], 'opa-chartlink')
                self.assertEqual(call[call.index('--env-file')+1], str(self.project / '.env'))
                self.assertEqual(call[call.index('-f')+1], str(self.project / 'compose.yaml'))

    def test_start_never_builds_or_pulls_and_has_explicit_scope(self):
        result = self.run_command('start')
        self.assertEqual(result.returncode, 0, result.stderr)
        up = next(c for c in self.calls() if 'up' in c)
        self.assertIn('--no-build', up)
        self.assertEqual(up[up.index('--pull')+1], 'never')
        self.assertFalse(any('build' in c for c in self.calls()))
        self.assert_scoped()

    def test_missing_images_stop_before_start(self):
        self.env['FAKE_MISSING'] = '1'
        self.assertNotEqual(self.run_command('start').returncode, 0)
        self.assertFalse(any('up' in c or 'build' in c for c in self.calls()))

    def test_import_preserves_running_service_and_missing_source(self):
        self.env['FAKE_RUNNING'] = '1'
        self.assertNotEqual(self.run_command('import-db', 'missing.db').returncode, 0)
        self.assertFalse(any('run' in c or 'stop' in c for c in self.calls()))
        self.env['FAKE_RUNNING'] = '0'
        self.assertNotEqual(self.run_command('import-db', 'missing.db').returncode, 0)
        self.assertFalse(any('run' in c for c in self.calls()))

    def test_import_handles_spaces_and_does_not_build(self):
        source = self.root / 'input with spaces.db'
        source.write_bytes(b'test fixture, not sent to a real database tool')
        result = self.run_command('import-db', str(source))
        self.assertEqual(result.returncode, 0, result.stderr)
        run = next(c for c in self.calls() if 'run' in c)
        self.assertIn(str(self.root)+':/source:ro', run)
        self.assertIn('/source/input with spaces.db', run)
        self.assertFalse(any('build' in c for c in self.calls()))
        self.assert_scoped()

    def test_export_then_verified_load_and_corruption_rejected(self):
        self.assertEqual(self.run_command('save-images').returncode, 0)
        folder = next(self.root.glob('chartlink-imagens-*'))
        self.assertEqual(self.run_command('load-images', str(folder)).returncode, 0)
        count = sum(c[:2] == ['image', 'load'] for c in self.calls())
        (folder / 'opa-chartlink-images.tar').write_bytes(b'corrupted')
        self.assertNotEqual(self.run_command('load-images', str(folder)).returncode, 0)
        self.assertEqual(count, sum(c[:2] == ['image', 'load'] for c in self.calls()))

    def test_build_is_explicit_and_uses_extra_file(self):
        self.assertEqual(self.run_command('build').returncode, 0)
        build = next(c for c in self.calls() if 'build' in c)
        self.assertIn(str(self.project / 'compose.build.yaml'), build)
        self.assertFalse(any('stop' in c or 'up' in c for c in self.calls()))
        self.assert_scoped()

    def test_failed_backup_prevents_update_start(self):
        self.env['FAKE_BACKUP_ERROR'] = '1'
        self.assertNotEqual(self.run_command('update').returncode, 0)
        self.assertTrue(any('stop' in c for c in self.calls()))
        self.assertFalse(any('up' in c for c in self.calls()))
        self.assert_scoped()


if __name__ == '__main__':
    unittest.main()
