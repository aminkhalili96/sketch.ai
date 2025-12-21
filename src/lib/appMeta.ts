import packageJson from '../../package.json';

export const appVersion = process.env.NEXT_PUBLIC_APP_VERSION ?? packageJson.version ?? '0.0.0';
export const appLastUpdated =
    process.env.NEXT_PUBLIC_APP_LAST_UPDATED ??
    process.env.NEXT_PUBLIC_APP_BUILD_TIME ??
    'local build';
