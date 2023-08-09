"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TibberHelper = void 0;
class TibberHelper {
    constructor(adapter) {
        this.adapter = adapter;
    }
    getStatePrefix(homeId, space, name) {
        const statePrefix = {
            key: name,
            value: "Homes." + homeId + "." + space + "." + name,
        };
        return statePrefix;
    }
    async checkAndSetValue(stateName, value, description) {
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
    async checkAndSetValueNumber(stateName, value, description) {
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
    async checkAndSetValueBoolean(stateName, value, description, role = "Boolean", read = true, write = true) {
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
    async checkAndSetValueBooleanAsButton(stateName, value, description) {
        return this.checkAndSetValueBoolean(stateName, value, description, "button", false, true);
    }
}
exports.TibberHelper = TibberHelper;
//# sourceMappingURL=tibberHelper.js.map