/* global URL, fetch, AbortSignal */
export default {
  async scheduled(_event, env) {
    if (!URL.canParse(env.ILP_PREVIEW_ORIGIN))
      throw new Error('Notification scheduler configuration is invalid.');
    const origin = new URL(env.ILP_PREVIEW_ORIGIN);
    if (
      origin.protocol !== 'https:' ||
      origin.href !== origin.origin + '/' ||
      origin.username ||
      origin.password ||
      !env.ILP_PUSH_JOB_SECRET
    ) {
      throw new Error('Notification scheduler configuration is invalid.');
    }
    const headers = { Authorization: 'Bearer ' + env.ILP_PUSH_JOB_SECRET };
    if (env.ILP_PREVIEW_BYPASS) headers['x-vercel-protection-bypass'] = env.ILP_PREVIEW_BYPASS;
    let response;
    try {
      response = await fetch(new URL('/api/push/job', origin), {
        method: 'POST',
        headers,
        // Workers supports manual redirects. The non-2xx check below rejects them.
        redirect: 'manual',
        signal: AbortSignal.timeout(50_000),
      });
    } catch {
      throw new Error('Notification scheduler could not reach the job.');
    }
    await response.body?.cancel();
    if (!response.ok) throw new Error('Notification job returned HTTP ' + response.status);
  },
};
