import { defineConfig } from 'wxt';

export default defineConfig({
  extensionApi: 'chrome',
  modules: ['@wxt-dev/module-react'],
  manifest: {
    name: 'Application Hub',
    description: 'Access your answer bank and draft with AI from any application form.',
    version: '0.0.1',
    permissions: ['storage', 'activeTab'],
  },
});
