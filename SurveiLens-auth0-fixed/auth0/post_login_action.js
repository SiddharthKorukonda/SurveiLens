// Dashboard → Actions → Library → Build Custom → Post-Login
exports.onExecutePostLogin = async (event, api) => {
  const roles = event.authorization?.roles || [];
  const perms = event.authorization?.permissions?.map(p => p.permission_name) || [];
  const siteId = event.user.app_metadata?.site_id || 'site-01';
  const ns = 'https://surveilens';
  api.idToken.setCustomClaim(`${ns}/roles`, roles);
  api.accessToken.setCustomClaim(`${ns}/roles`, roles);
  api.accessToken.setCustomClaim(`${ns}/site_id`, siteId);
  if (perms.includes('alerts:write')) {
    api.multifactor.enable('any');
  }
};
