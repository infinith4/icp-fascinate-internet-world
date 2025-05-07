import Hls from 'hls.js';
import { Actor, HttpAgent } from '@dfinity/agent';
import { createActor } from '../../../declarations/streamingservice_backend';
import { _SERVICE } from '../../../declarations/streamingservice_backend/streamingservice_backend.did';

export class CustomLoader extends Hls.DefaultConfig.loader {
  load(context: any, config: any, callbacks: any) {
    if (context.url.startsWith('icsegment://')) {
      const match = context.url.match(/^icsegment:\/\/(.+)\/(\d+)$/);
      if (match) {
        const [, vId, segIdx] = match;
        const segmentId = Number(segIdx);

        const agent = new HttpAgent({
          host: 'http://localhost:' + import.meta.env.VITE_LOCAL_CANISTER_PORT,
        });

        const actor = createActor(import.meta.env.VITE_CANISTER_ID_STREAMINGSERVICE_BACKEND || '', {
          agent,
        }) as Actor & _SERVICE;

        actor.get_hls_segment(vId, segmentId)
          .then((result: any) => {
            if (result && 'ok' in result) {
              const data = new Uint8Array(result.ok);
              if (data.length > 0) {
                callbacks.onSuccess({
                  data: data.buffer,
                  stats: {
                    loaded: data.length,
                    total: data.length,
                    retry: 0,
                    aborted: false,
                    loading: { first: 0, start: 0, end: 0 },
                    parsing: { start: 0, end: 0 },
                    buffering: { first: 0, start: 0, end: 0 }
                  },
                  url: context.url
                }, context, {});
              } else {
                throw new Error('Empty segment data');
              }
            } else {
              throw new Error(result.err || 'Segment fetch error');
            }
          })
          .catch((error) => {
            console.error('Failed to load segment:', error);
            callbacks.onError({
              code: 500,
              text: `Failed to load segment: ${error.message}`,
              url: context.url
            }, context, null);
          });
        return;
      }
    }
    super.load(context, config, callbacks);
  }
}