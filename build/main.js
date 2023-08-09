"use strict";
/*
 * Created with @iobroker/create-adapter v2.0.2
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
// The adapter-core module gives you access to the core ioBroker functions
// you need to create an adapter
const utils = __importStar(require("@iobroker/adapter-core"));
const luxon_1 = require("luxon");
const tibberAPICaller_1 = require("./lib/tibberAPICaller");
const tibberPulse_1 = require("./lib/tibberPulse");
class Tibberconnect extends utils.Adapter {
    constructor(options = {}) {
        super({
            ...options,
            name: "tibberconnect",
        });
        this.queryUrl = "";
        this.sortPriceAtByTotal = (dir) => {
            return (a, b) => (a.total - b.total) * dir;
        };
        this.sortByDateTime = (dir) => {
            return (a, b) => (a.toMillis() - b.toMillis()) * dir;
        };
        this.on("ready", this.onReady.bind(this));
        this.on("stateChange", this.onStateChange.bind(this));
        // this.on("objectChange", this.onObjectChange.bind(this));
        // this.on("message", this.onMessage.bind(this));
        this.on("unload", this.onUnload.bind(this));
        this.homeIdList = [];
        this.intervallList = [];
        this.queryUrl = "https://api.tibber.com/v1-beta/gql";
    }
    /**
     * Is called when databases are connected and adapter received configuration.
     */
    async onReady() {
        // Initialize your adapter here
        // Reset the connection indicator during startup;
        if (!this.config.TibberAPIToken) {
            // No Token defined in configuration
            this.log.warn("Missing API Token - please check configuration");
            this.setState("info.connection", false, true);
        }
        else {
            // Need 2 configs - API and Feed (feed chaged query url)
            const tibberConfigAPI = {
                active: true,
                apiEndpoint: {
                    apiKey: this.config.TibberAPIToken,
                    queryUrl: this.queryUrl,
                },
            };
            const tibberConfigFeed = {
                active: true,
                apiEndpoint: {
                    apiKey: this.config.TibberAPIToken,
                    queryUrl: this.queryUrl,
                },
            };
            // Now read all Data from API
            const tibberAPICaller = new tibberAPICaller_1.TibberAPICaller(tibberConfigAPI, this);
            try {
                this.homeIdList = await tibberAPICaller.updateHomesFromAPI();
            }
            catch (error) {
                this.log.warn(tibberAPICaller.generateErrorMessage(error, "getting 'homes'"));
            }
            // if feed is not used - set info.connection if data received
            if (!this.config.FeedActive) {
                if (this.homeIdList.length > 0) {
                    this.setState("info.connection", true, true);
                    this.log.debug("Connection Check: Feed not enabled and I received home list from api - good connection");
                }
                else {
                    this.setState("info.connection", false, true);
                    this.log.debug("Connection Check: Feed not enabled and I do not get home list from api - bad connection");
                }
            }
            // Init Load Data for home
            for (const index in this.homeIdList) {
                try {
                    await tibberAPICaller.updateCurrentPrice(this.homeIdList[index]);
                }
                catch (error) {
                    this.log.warn(tibberAPICaller.generateErrorMessage(error, "Abruf 'Aktueller Preis'"));
                }
            }
            for (const homeId of this.homeIdList) {
                await this.updatePrices(tibberAPICaller, homeId);
            }
            const energyPriceCallIntervall = this.setInterval(() => {
                for (const homeId of this.homeIdList) {
                    try {
                        tibberAPICaller.updateCurrentPrice(homeId);
                    }
                    catch (error) {
                        this.log.warn(tibberAPICaller.generateErrorMessage(error, "Abruf 'Aktueller Preis'"));
                    }
                }
            }, 5 * 60 * 1000);
            this.intervallList.push(energyPriceCallIntervall);
            const energyPricesListUpdateInterval = this.setInterval(async () => {
                const updates = [];
                for (const homeId of this.homeIdList) {
                    updates.push(this.updatePrices(tibberAPICaller, homeId));
                }
                await Promise.all(updates);
            }, 5 * 60 * 1000);
            this.intervallList.push(energyPricesListUpdateInterval);
            // If User uses TibberConfig - start connection
            if (this.config.FeedActive) {
                for (const homeId of this.homeIdList) {
                    try {
                        tibberConfigFeed.homeId = homeId;
                        // define fields for Datafeed
                        tibberConfigFeed.timestamp = true;
                        tibberConfigFeed.power = true;
                        if (this.config.FeedConfigLastMeterConsumption) {
                            tibberConfigFeed.lastMeterConsumption = true;
                        }
                        if (this.config.FeedConfigAccumulatedConsumption) {
                            tibberConfigFeed.accumulatedConsumption = true;
                        }
                        if (this.config.FeedConfigAccumulatedProduction) {
                            tibberConfigFeed.accumulatedProduction = true;
                        }
                        if (this.config.FeedConfigAccumulatedConsumptionLastHour) {
                            tibberConfigFeed.accumulatedConsumptionLastHour = true;
                        }
                        if (this.config.FeedConfigAccumulatedProductionLastHour) {
                            tibberConfigFeed.accumulatedProductionLastHour = true;
                        }
                        if (this.config.FeedConfigAccumulatedCost) {
                            tibberConfigFeed.accumulatedCost = true;
                        }
                        if (this.config.FeedConfigAccumulatedCost) {
                            tibberConfigFeed.accumulatedReward = true;
                        }
                        if (this.config.FeedConfigCurrency) {
                            tibberConfigFeed.currency = true;
                        }
                        if (this.config.FeedConfigMinPower) {
                            tibberConfigFeed.minPower = true;
                        }
                        if (this.config.FeedConfigAveragePower) {
                            tibberConfigFeed.averagePower = true;
                        }
                        if (this.config.FeedConfigMaxPower) {
                            tibberConfigFeed.maxPower = true;
                        }
                        if (this.config.FeedConfigPowerProduction) {
                            tibberConfigFeed.powerProduction = true;
                        }
                        if (this.config.FeedConfigMinPowerProduction) {
                            tibberConfigFeed.minPowerProduction = true;
                        }
                        if (this.config.FeedConfigMaxPowerProduction) {
                            tibberConfigFeed.maxPowerProduction = true;
                        }
                        if (this.config.FeedConfigLastMeterProduction) {
                            tibberConfigFeed.lastMeterProduction = true;
                        }
                        if (this.config.FeedConfigPowerFactor) {
                            tibberConfigFeed.powerFactor = true;
                        }
                        if (this.config.FeedConfigVoltagePhase1) {
                            tibberConfigFeed.voltagePhase1 = true;
                        }
                        if (this.config.FeedConfigVoltagePhase2) {
                            tibberConfigFeed.voltagePhase2 = true;
                        }
                        if (this.config.FeedConfigVoltagePhase3) {
                            tibberConfigFeed.voltagePhase3 = true;
                        }
                        if (this.config.FeedConfigCurrentL1) {
                            tibberConfigFeed.currentL1 = true;
                        }
                        if (this.config.FeedConfigCurrentL2) {
                            tibberConfigFeed.currentL2 = true;
                        }
                        if (this.config.FeedConfigCurrentL3) {
                            tibberConfigFeed.currentL3 = true;
                        }
                        if (this.config.FeedConfigSignalStrength) {
                            tibberConfigFeed.signalStrength = true;
                        }
                        const tibberPulse = new tibberPulse_1.TibberPulse(tibberConfigFeed, this);
                        tibberPulse.ConnectPulseStream();
                    }
                    catch (e) {
                        this.log.warn(e.message);
                    }
                }
            }
            this.subscribeStates("*.Calculations.GetBestTime");
        }
    }
    async updatePrices(tibberAPICaller, homeId) {
        try {
            await tibberAPICaller.updatePricesToday(homeId);
        }
        catch (error) {
            this.log.warn(tibberAPICaller.generateErrorMessage(error, "Abruf 'Preise von heute'"));
        }
        try {
            await tibberAPICaller.updatePricesTomorrow(homeId);
        }
        catch (error) {
            this.log.warn(tibberAPICaller.generateErrorMessage(error, "Abruf 'Preise von morgen'"));
        }
    }
    /**
     * Is called when adapter shuts down - callback has to be called under any circumstances!
     */
    onUnload(callback) {
        try {
            // Here you must clear all timeouts or intervals that may still be active
            // clearTimeout(timeout1);
            // clearTimeout(timeout2);
            // ...
            // clearInterval(interval1);
            for (const index in this.intervallList) {
                this.clearInterval(this.intervallList[index]);
            }
            // info.connect to false, if adapter is closed
            this.setState("info.connection", false, true);
            callback();
        }
        catch (e) {
            callback();
        }
    }
    /**
     * Is called if a subscribed state changes
     */
    async onStateChange(id, state) {
        var _a, _b;
        if (state) {
            if (id.startsWith(this.namespace) && id.endsWith(".Calculations.GetBestTime") && state.val === true) {
                const nameSpaceWithHomeId = id.substring(0, id.indexOf(".Calculations.GetBestTime"));
                try {
                    const [Duration, LastEnd] = await Promise.all([
                        this.getStateAsync(nameSpaceWithHomeId + ".Calculations.Duration"),
                        this.getStateAsync(nameSpaceWithHomeId + ".Calculations.LastEnd"),
                        this.setStateAsync(nameSpaceWithHomeId + ".Calculations.CronString", {
                            val: "",
                            ack: true,
                        }),
                        this.setStateAsync(nameSpaceWithHomeId + ".Calculations.BestStart", {
                            val: "",
                            ack: true,
                        }),
                    ]);
                    const duration = (_a = Number(Duration === null || Duration === void 0 ? void 0 : Duration.val)) !== null && _a !== void 0 ? _a : 0, lastEnd = (_b = String(LastEnd === null || LastEnd === void 0 ? void 0 : LastEnd.val)) !== null && _b !== void 0 ? _b : "", result = await this.get_best_timeslot(nameSpaceWithHomeId, duration, lastEnd);
                    this.log.debug("Duration: " + (Duration === null || Duration === void 0 ? void 0 : Duration.val) + ", LastEnd: " + (LastEnd === null || LastEnd === void 0 ? void 0 : LastEnd.val) + ", result: " + result);
                    await Promise.all([
                        this.setStateAsync(nameSpaceWithHomeId + ".Calculations.Duration", {
                            ack: true,
                        }),
                        this.setStateAsync(nameSpaceWithHomeId + ".Calculations.LastEnd", {
                            val: luxon_1.DateTime.fromISO(lastEnd).toISO(),
                            ack: true,
                        }),
                        this.setStateAsync(nameSpaceWithHomeId + ".Calculations.Feedback", {
                            val: JSON.stringify(result),
                            ack: true,
                        }),
                    ]);
                    if (result.length > 0) {
                        const BestStart = result[0];
                        await this.setStateAsync(nameSpaceWithHomeId + ".Calculations.BestStart", {
                            val: BestStart.toISO(),
                            ack: true,
                        });
                        const startdate = luxon_1.DateTime.fromObject({
                            year: BestStart.year,
                            month: BestStart.month,
                            day: BestStart.day,
                        });
                        const cron = [
                            '{"time":{"exactTime":true,"start":"',
                            BestStart.hour,
                            ':00"},"period":{"once":"',
                            startdate,
                            '"}}',
                        ].join("");
                        await this.setStateAsync(nameSpaceWithHomeId + ".Calculations.CronString", {
                            val: cron,
                            ack: true,
                        });
                    }
                    else {
                        await this.setStateAsync(nameSpaceWithHomeId + ".Calculations.Feedback", {
                            val: "no results found",
                            ack: true,
                        });
                    }
                }
                catch (error) {
                    this.log.error(error);
                }
                finally {
                    await this.setStateAsync(nameSpaceWithHomeId + ".Calculations.GetBestTime", {
                        val: false,
                        ack: true,
                    });
                }
            }
            else {
                // The state was changed
                this.log.silly(`state ${id} changed: ${state.val} (ack = ${state.ack})`);
            }
        }
        else {
            // The state was deleted
            this.log.debug(`state ${id} deleted`);
        }
    }
    async get_best_timeslot(namespaceWithHomeId, duration, LastEnd) {
        //todo: integration usage of "firstStart"
        try {
            if (!luxon_1.DateTime.fromISO(LastEnd).isValid) {
                const ErrorMsg = "Entry provided for LastEnd is no valid formatted Date (expect ISO 8601 string). LastEnd: " +
                    LastEnd;
                await this.setStateAsync(namespaceWithHomeId + ".Calculations.Feedback", {
                    val: "Error: " + ErrorMsg,
                    ack: true,
                });
                throw new Error(ErrorMsg);
            }
            if (!Number.isInteger(duration)) {
                const ErrorMsg = "Entry provided for Duration is no integer. Duration: " + duration;
                await this.setStateAsync(namespaceWithHomeId + ".Calculations.Feedback", {
                    val: "Error: " + ErrorMsg,
                    ack: true,
                });
                throw new Error(ErrorMsg);
            }
            const now = luxon_1.DateTime.now();
            const LastEndDate = luxon_1.DateTime.fromISO(LastEnd);
            let ErrorMsg = "";
            if (LastEndDate < now) {
                ErrorMsg = "Entry provided for LastEnd in the past. LastEnd: " + LastEnd;
            }
            const diff = LastEndDate.toMillis() - now.toMillis();
            const diff_hours = Math.floor(diff / (1000 * 60 * 60));
            if (now.hour < 14 && diff_hours + now.hour > 23) {
                ErrorMsg =
                    "LastEnd too far in future - price data for tomorrow only available after 1pm today. LastEnd: " +
                        LastEnd;
            }
            if (diff_hours + now.hour > 47) {
                ErrorMsg =
                    "LastEnd to far in future - price data only available until tomorrow midnight. LastEnd: " + LastEnd;
            }
            if (now.plus({ hours: duration }) >= LastEndDate) {
                ErrorMsg = "LastEnd too soon for given duration. LastEnd: " + LastEnd + ", duration: " + duration;
            }
            if (ErrorMsg !== "") {
                this.log.error(ErrorMsg);
                await this.setStateAsync(namespaceWithHomeId + ".Calculations.Feedback", {
                    val: "Error: " + ErrorMsg,
                    ack: true,
                });
                throw new Error(ErrorMsg);
            }
            const prices = await this.get_prices(namespaceWithHomeId, LastEndDate);
            this.log.debug("prices : " + JSON.stringify(prices));
            const prices_sorted = prices.slice().sort(this.sortPriceAtByTotal(1));
            this.log.debug("prices sorted : " + JSON.stringify(prices));
            return prices_sorted
                .slice(0, duration)
                .map(({ startsAt }) => startsAt)
                .sort(this.sortByDateTime(1));
        }
        catch (error) {
            error = "error during calculation of best hours: " + error;
            this.log.error(error);
            throw new Error(error);
        }
    }
    async get_prices(namespaceWithHomeId, LastEndDate) {
        const now = luxon_1.DateTime.now();
        const current_hour = now.hour;
        const maxHour = LastEndDate.hour + 24 * (LastEndDate.day - now.day);
        this.log.silly("maxHour " + maxHour);
        const prices = [];
        for (let i = current_hour + 1; i < Math.min(maxHour, 24); i++) {
            this.log.silly("using today." + i);
            const [total, startsAt] = await Promise.all([
                this.getStateAsync(namespaceWithHomeId + ".PricesToday." + i + ".total"),
                this.getStateAsync(namespaceWithHomeId + ".PricesToday." + i + ".startsAt"),
            ]);
            this.log.silly("total." + i + ": " + JSON.stringify(total));
            this.log.silly("startAt." + i + ": " + JSON.stringify(startsAt));
            if ((total === null || total === void 0 ? void 0 : total.val) && (startsAt === null || startsAt === void 0 ? void 0 : startsAt.val))
                prices.push({
                    total: Number(total.val),
                    startsAt: luxon_1.DateTime.fromISO(String(startsAt.val)),
                });
        }
        if (maxHour >= 24) {
            for (let i = 0; i < maxHour - 24; i++) {
                const [total, startsAt] = await Promise.all([
                    this.getStateAsync(namespaceWithHomeId + ".PricesTomorrow." + i + ".total"),
                    this.getStateAsync(namespaceWithHomeId + ".PricesTomorrow." + i + ".startsAt"),
                ]);
                this.log.silly("tomorrow." + i + ": " + JSON.stringify(total));
                this.log.silly("startAt." + i + ": " + JSON.stringify(startsAt));
                if ((total === null || total === void 0 ? void 0 : total.val) && (startsAt === null || startsAt === void 0 ? void 0 : startsAt.val)) {
                    const startAt = luxon_1.DateTime.fromISO(String(startsAt.val));
                    if (startAt.toMillis() > now.toMillis() && startAt.toMillis() < LastEndDate.toMillis()) {
                        this.log.silly("using tomorrow." + i);
                        prices.push({
                            total: Number(total.val),
                            startsAt: luxon_1.DateTime.fromISO(String(startsAt.val)),
                        });
                    }
                }
            }
        }
        return prices;
    }
    async checkAndSetStateStringFromAPI(name, value, displayName) {
        if (value) {
            await this.setObjectNotExistsAsync(name, {
                type: "state",
                common: {
                    name: displayName,
                    type: "string",
                    role: "string",
                    read: true,
                    write: true,
                },
                native: {},
            });
            await this.setStateAsync(name, value, true);
        }
    }
    async checkAndSetStateNumberFromAPI(name, value, displayName) {
        if (value) {
            await this.setObjectNotExistsAsync(name, {
                type: "state",
                common: {
                    name: displayName,
                    type: "number",
                    role: "number",
                    read: true,
                    write: true,
                },
                native: {},
            });
            await this.setStateAsync(name, value, true);
        }
    }
    async setStateBoolFromAPI(name, value, displayName) {
        await this.setObjectNotExistsAsync(name, {
            type: "state",
            common: {
                name: displayName,
                type: "boolean",
                role: "boolean",
                read: true,
                write: true,
            },
            native: {},
        });
        await this.setStateAsync(name, value, true);
    }
}
if (require.main !== module) {
    // Export the constructor in compact mode
    module.exports = (options) => new Tibberconnect(options);
}
else {
    // otherwise start the instance directly
    (() => new Tibberconnect())();
}
//# sourceMappingURL=main.js.map