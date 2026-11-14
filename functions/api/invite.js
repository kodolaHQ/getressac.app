import { handleInvite } from '../../src/invite.js';

export const onRequestPost = (ctx) => handleInvite({ request: ctx.request, env: ctx.env });
