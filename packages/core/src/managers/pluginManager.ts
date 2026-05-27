export type NeonPlugin = {
  name: string;
  version: string;
  setup(): Promise<void> | void;
};

export class PluginManager {
  private readonly plugins = new Map<string, NeonPlugin>();

  register(plugin: NeonPlugin) {
    if (this.plugins.has(plugin.name)) throw new Error(`Plugin duplicado: ${plugin.name}`);
    this.plugins.set(plugin.name, plugin);
  }

  async boot() {
    for (const plugin of this.plugins.values()) {
      await plugin.setup();
    }
  }

  list() {
    return [...this.plugins.values()].map(({ name, version }) => ({ name, version }));
  }
}
