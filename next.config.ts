import type {NextConfig} from 'next';
const config:NextConfig={output:'standalone',serverExternalPackages:['node:sqlite'],experimental:{cpus:2}};
export default config;
