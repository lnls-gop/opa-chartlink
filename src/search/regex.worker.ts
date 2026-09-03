import { matchRegex, type RegexRequest } from './matcher';

self.onmessage = (event: MessageEvent<RegexRequest>) => {
  self.postMessage(matchRegex(event.data));
};
