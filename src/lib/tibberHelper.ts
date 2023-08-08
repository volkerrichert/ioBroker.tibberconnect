import * as utils from "@iobroker/adapter-core";

export class TibberHelper {
	adapter: utils.AdapterInstance;

	constructor(adapter: utils.AdapterInstance) {
		this.adapter = adapter;
	}

	protected getStatePrefix(homeId: string, space: string, name: string): { [key: string]: string } {
		const statePrefix = {
			key: name,
			value: "Homes." + homeId + "." + space + "." + name,
		};
		return statePrefix;
	}

	protected async checkAndSetValue(
		stateName: { [key: string]: string },
		value: string,
		description?: string,
	): Promise<void> {
		if (value !== null) {
			await this.adapter.setObjectNotExistsAsync(stateName.value, {
				type: "state",
				common: {
					name: stateName.key,
					type: "string",
					role: "String",
					desc: description,
					read: true,
					write: true,
				},
				native: {},
			});

			await this.adapter.setStateAsync(stateName.value, value, true);
		}
	}

	protected async checkAndSetValueNumber(
		stateName: { [key: string]: string },
		value: number,
		description?: string,
	): Promise<void> {
		if (value !== null) {
			await this.adapter.setObjectNotExistsAsync(stateName.value, {
				type: "state",
				common: {
					name: stateName.key,
					type: "number",
					role: "Number",
					desc: description,
					read: true,
					write: true,
				},
				native: {},
			});

			await this.adapter.setStateAsync(stateName.value, value, true);
		}
	}

	protected async checkAndSetValueBoolean(
		stateName: { [key: string]: string },
		value: boolean,
		description?: string,
		role = "Boolean",
		read = true,
		write = true,
	): Promise<void> {
		if (value !== null) {
			await this.adapter.setObjectNotExistsAsync(stateName.value, {
				type: "state",
				common: {
					name: stateName.key,
					type: "boolean",
					role,
					desc: description,
					read,
					write,
				},
				native: {},
			});

			await this.adapter.setStateAsync(stateName.value, value, true);
		}
	}

	protected async checkAndSetValueBooleanAsButton(
		stateName: { [key: string]: string },
		value: boolean,
		description?: string,
	): Promise<void> {
		return this.checkAndSetValueBoolean(stateName, value, description, "button", false, true);
	}
}
