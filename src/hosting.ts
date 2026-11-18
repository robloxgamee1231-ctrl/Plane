/** Public assets resolve inside the deployment, including repository subpaths on Pages. */
export const assetUrl = (
  name: 'ndx.svg' | `art/${string}` | `models/${string}` | `textures/${string}`,
) => `${import.meta.env.BASE_URL}${name}`;

/** Pages has no account server. Never send credentials or attempt cloud sync in that edition. */
export const localProfilesOnly = import.meta.env.MODE === 'pages';
