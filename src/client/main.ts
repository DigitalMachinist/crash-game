/** SPA entry point — mounts `App.svelte` to the `#app` element. */
import { mount } from 'svelte';
import App from './App.svelte';

const app = mount(App, { target: document.getElementById('app')! });

export default app;
