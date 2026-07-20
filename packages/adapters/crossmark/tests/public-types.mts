import {
  CrossmarkSDK,
  type CrossmarkActiveRequest,
  type CrossmarkClient,
} from '@xrpl-connect/adapter-crossmark';

const client: CrossmarkClient = CrossmarkSDK.default;
const networkListener = (network: typeof CrossmarkSDK.typings.BasicNetwork) => {
  void network;
};

client.on(CrossmarkSDK.typings.EVENTS.NETWORK_CHANGE, networkListener);
client.once(CrossmarkSDK.typings.EVENTS.NETWORK_CHANGE, networkListener);
client.off(CrossmarkSDK.typings.EVENTS.NETWORK_CHANGE, networkListener);
client.removeListener(CrossmarkSDK.typings.EVENTS.NETWORK_CHANGE, networkListener);
client.addListener('custom', networkListener);
client.prependListener('custom', networkListener);
client.prependOnceListener('custom', networkListener);
client.removeAllListeners('custom');
client.setMaxListeners(20);
client.getMaxListeners();
client.listeners('custom')[0]?.({ network: 'xrpl' });
client.rawListeners('custom')[0]?.({ network: 'xrpl' });
client.emit('custom', { network: 'xrpl' });
client.listenerCount('custom');
client.eventNames();

client.api.on('response', networkListener);
client.mount.addListener('detected', () => {});

const activeRequest: CrossmarkActiveRequest = {
  resolve: () => {},
  reject: () => {},
};
client.api.active.set('request-id', activeRequest);
client.api.active.get('request-id')?.resolve(undefined);
