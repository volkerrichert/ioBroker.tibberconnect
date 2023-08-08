import * as utils from "@iobroker/adapter-core";
import { IConfig, TibberQuery } from "tibber-api";
import { PriceLevel } from "tibber-api/lib/src/models/enums/PriceLevel";
import { IAddress } from "tibber-api/lib/src/models/IAddress";
import { IContactInfo } from "tibber-api/lib/src/models/IContactInfo";
import { ILegalEntity } from "tibber-api/lib/src/models/ILegalEntity";
import { IPrice } from "tibber-api/lib/src/models/IPrice";
import { TibberHelper } from "./tibberHelper";

export class TibberAPICaller extends TibberHelper {
	tibberConfig: IConfig;
	tibberQuery: TibberQuery;
	currentHomeId: string;

	constructor(tibberConfig: IConfig, adapter: utils.AdapterInstance) {
		super(adapter);
		this.tibberConfig = tibberConfig;
		this.tibberQuery = new TibberQuery(this.tibberConfig);
		this.currentHomeId = "";
	}

	async updateHomesFromAPI(): Promise<string[]> {
		const currentHomes = await this.tibberQuery.getHomes();
		this.adapter.log.debug("Get homes from tibber api: " + JSON.stringify(currentHomes));
		const homeIdList: string[] = [];
		for (const homeIndex in currentHomes) {
			const currentHome = currentHomes[homeIndex];
			this.currentHomeId = currentHome.id;
			homeIdList.push(this.currentHomeId);
			// Set HomeId in tibberConfig for further API Calls
			this.tibberConfig.homeId = this.currentHomeId;
			// Home GENERAL
			await Promise.all([
				this.checkAndSetValue(
					this.getStatePrefix(this.currentHomeId, "General", "Id"),
					currentHome.id,
					"ID of your home",
				),
				this.checkAndSetValue(
					this.getStatePrefix(this.currentHomeId, "General", "Timezone"),
					currentHome.timeZone,
					"The time zone the home resides in",
				),
				this.checkAndSetValue(
					this.getStatePrefix(this.currentHomeId, "General", "NameInApp"),
					currentHome.appNickname,
					"The nickname given to the home by the user",
				),
				this.checkAndSetValue(
					this.getStatePrefix(this.currentHomeId, "General", "AvatarInApp"),
					currentHome.appAvatar,
					"The chosen avatar for the home",
				), // Values: APARTMENT, ROWHOUSE, FLOORHOUSE1, FLOORHOUSE2, FLOORHOUSE3, COTTAGE, CASTLE
				this.checkAndSetValue(
					this.getStatePrefix(this.currentHomeId, "General", "Type"),
					currentHome.type,
					"The type of home.",
				), // Values: APARTMENT, ROWHOUSE, HOUSE, COTTAGE
				this.checkAndSetValue(
					this.getStatePrefix(this.currentHomeId, "General", "PrimaryHeatingSource"),
					currentHome.primaryHeatingSource,
					"The primary form of heating in the household",
				), // Values: AIR2AIR_HEATPUMP, ELECTRICITY, GROUND, DISTRICT_HEATING, ELECTRIC_BOILER, AIR2WATER_HEATPUMP, OTHER
				this.checkAndSetValueNumber(
					this.getStatePrefix(this.currentHomeId, "General", "Size"),
					currentHome.size,
					"The size of the home in square meters",
				),
				this.checkAndSetValueNumber(
					this.getStatePrefix(this.currentHomeId, "General", "NumberOfResidents"),
					currentHome.numberOfResidents,
					"The number of people living in the home",
				),
				this.checkAndSetValueNumber(
					this.getStatePrefix(this.currentHomeId, "General", "MainFuseSize"),
					currentHome.mainFuseSize,
					"The main fuse size",
				),
				this.checkAndSetValueBoolean(
					this.getStatePrefix(this.currentHomeId, "General", "HasVentilationSystem"),
					currentHome.hasVentilationSystem,
					"Whether the home has a ventilation system",
				),
				this.checkAndSetValueBooleanAsButton(
					this.getStatePrefix(this.currentHomeId, "Calculations", "GetBestTime"),
					false,
					"Start calculate best time",
				),
				this.checkAndSetValue(
					this.getStatePrefix(this.currentHomeId, "Calculations", "BestStart"),
					"",
					"Start timestamp",
				),
				this.checkAndSetValue(
					this.getStatePrefix(this.currentHomeId, "Calculations", "CronString"),
					"",
					"Cron String",
				),
				this.checkAndSetValueNumber(
					this.getStatePrefix(this.currentHomeId, "Calculations", "Duration"),
					1,
					"Duration",
				),
				this.checkAndSetValue(
					this.getStatePrefix(this.currentHomeId, "Calculations", "Feedback"),
					"",
					"Feedback of calculation",
				),
				this.checkAndSetValue(
					this.getStatePrefix(this.currentHomeId, "Calculations", "LastEnd"),
					"",
					"The last end for calculation",
				),
			]);

			this.fetchAddress("Address", currentHome.address);
			this.fetchLegalEntity("Owner", currentHome.owner);

			// TO DO: currentHome.currentSubscription
			// TO DO: currentHome.subscriptions
			// TO DO: currentHome.consumption
			// TO DO: currentHome.production

			this.checkAndSetValueBoolean(
				this.getStatePrefix(this.currentHomeId, "Features", "RealTimeConsumptionEnabled"),
				currentHome.features.realTimeConsumptionEnabled,
			);
		}

		return homeIdList;
	}

	public generateErrorMessage(error: any, context: string): string {
		if (error.errors) {
			let errorMessages = "";
			for (const index in error.errors) {
				if (errorMessages) {
					errorMessages += ", ";
				}
				errorMessages += error.errors[index].message;
			}
			return "Error (" + error.statusMessage + ") during: " + context + ": " + errorMessages;
		} else {
			return "Error (" + error.message + ") during: " + context + ":\n" + error.stack;
		}

	}

	async updateCurrentPrice(homeId: string): Promise<void> {
		if (homeId) {
			const currentPrice = await this.tibberQuery.getCurrentEnergyPrice(homeId);
			this.adapter.log.debug("Get current price from tibber api: " + JSON.stringify(currentPrice));
			this.currentHomeId = homeId;
			await this.fetchPrice("CurrentPrice", currentPrice);
		}
	}

	async updatePricesToday(homeId: string): Promise<void> {
		const pricesToday = await this.tibberQuery.getTodaysEnergyPrices(homeId);
		this.adapter.log.debug("Get prices today from tibber api: " + JSON.stringify(pricesToday));
		this.currentHomeId = homeId;
		const average: IPrice = {
			tax: 0,
			total: 0,
			startsAt: pricesToday[0].startsAt,
			homeId,
			energy: 0,
			level: PriceLevel.NORMAL,
		};
		for (const index in pricesToday) {
			const price = pricesToday[index];
			const hour = new Date(price.startsAt).getHours();
			average.tax += price.tax;
			average.total += price.total;
			average.energy += price.energy;
			this.fetchPrice("PricesToday." + hour, price);
		}

		average.tax /= pricesToday.length;
		average.total /= pricesToday.length;
		average.energy /= pricesToday.length;
		this.fetchPrice("PricesToday.average", average);
	}

	async updatePricesTomorrow(homeId: string): Promise<void> {
		const pricesTomorrow = await this.tibberQuery.getTomorrowsEnergyPrices(homeId);
		this.adapter.log.debug("Get prices tomorrow from tibber api: " + JSON.stringify(pricesTomorrow));
		this.currentHomeId = homeId;
		if (pricesTomorrow.length > 0) {
			const average: IPrice = {
				tax: 0,
				total: 0,
				startsAt: pricesTomorrow[0].startsAt,
				homeId,
				energy: 0,
				level: PriceLevel.NORMAL,
			};
			for (const index in pricesTomorrow) {
				const price = pricesTomorrow[index];
				const hour = new Date(price.startsAt).getHours();
				average.tax += price.tax;
				average.total += price.total;
				average.energy += price.energy;
				this.fetchPrice("PricesTomorrow." + hour, price);
			}

			average.tax /= pricesTomorrow.length;
			average.total /= pricesTomorrow.length;
			average.energy /= pricesTomorrow.length;
			this.fetchPrice("PricesTomorrow.average", average);
		}
	}

	private fetchAddress(objectDestination: string, address: IAddress): void {
		this.checkAndSetValue(this.getStatePrefix(this.currentHomeId, objectDestination, "address1"), address.address1);
		this.checkAndSetValue(this.getStatePrefix(this.currentHomeId, objectDestination, "address2"), address.address2);
		this.checkAndSetValue(this.getStatePrefix(this.currentHomeId, objectDestination, "address3"), address.address3);
		this.checkAndSetValue(this.getStatePrefix(this.currentHomeId, objectDestination, "City"), address.city);
		this.checkAndSetValue(
			this.getStatePrefix(this.currentHomeId, objectDestination, "PostalCode"),
			address.postalCode,
		);
		this.checkAndSetValue(this.getStatePrefix(this.currentHomeId, objectDestination, "Country"), address.country);
		this.checkAndSetValue(this.getStatePrefix(this.currentHomeId, objectDestination, "Latitude"), address.latitude);
		this.checkAndSetValue(
			this.getStatePrefix(this.currentHomeId, objectDestination, "Longitude"),
			address.longitude,
		);
	}

	private fetchPrice(objectDestination: string, price: IPrice): void {
		this.checkAndSetValueNumber(
			this.getStatePrefix(this.currentHomeId, objectDestination, "total"),
			price.total,
			"The total price (energy + taxes)",
		);
		this.checkAndSetValueNumber(
			this.getStatePrefix(this.currentHomeId, objectDestination, "energy"),
			price.energy,
			"Nordpool spot price",
		);
		this.checkAndSetValueNumber(
			this.getStatePrefix(this.currentHomeId, objectDestination, "tax"),
			price.tax,
			"The tax part of the price (guarantee of origin certificate, energy tax (Sweden only) and VAT)",
		);
		this.checkAndSetValue(
			this.getStatePrefix(this.currentHomeId, objectDestination, "startsAt"),
			price.startsAt,
			"The start time of the price",
		);
		//this.checkAndSetValue(this.getStatePrefix(objectDestination, "currency"), price.currency, "The price currency");
		this.checkAndSetValue(
			this.getStatePrefix(this.currentHomeId, objectDestination, "level"),
			price.level,
			"The price level compared to recent price values",
		);
	}

	private fetchLegalEntity(objectDestination: string, legalEntity: ILegalEntity): void {
		this.checkAndSetValue(this.getStatePrefix(this.currentHomeId, objectDestination, "Id"), legalEntity.id);
		this.checkAndSetValue(
			this.getStatePrefix(this.currentHomeId, objectDestination, "FirstName"),
			legalEntity.firstName,
		);
		this.checkAndSetValueBoolean(
			this.getStatePrefix(this.currentHomeId, objectDestination, "IsCompany"),
			legalEntity.isCompany,
		);
		this.checkAndSetValue(this.getStatePrefix(this.currentHomeId, objectDestination, "Name"), legalEntity.name);
		this.checkAndSetValue(
			this.getStatePrefix(this.currentHomeId, objectDestination, "MiddleName"),
			legalEntity.middleName,
		);
		this.checkAndSetValue(
			this.getStatePrefix(this.currentHomeId, objectDestination, "LastName"),
			legalEntity.lastName,
		);
		this.checkAndSetValue(
			this.getStatePrefix(this.currentHomeId, objectDestination, "OrganizationNo"),
			legalEntity.organizationNo,
		);
		this.checkAndSetValue(
			this.getStatePrefix(this.currentHomeId, objectDestination, "Language"),
			legalEntity.language,
		);
		if (legalEntity.contactInfo) {
			this.fetchContactInfo(objectDestination + ".ContactInfo", legalEntity.contactInfo);
		}
		if (legalEntity.address) {
			this.fetchAddress(objectDestination + ".Address", legalEntity.address);
		}
	}

	private fetchContactInfo(objectDestination: string, contactInfo: IContactInfo): void {
		this.checkAndSetValue(this.getStatePrefix(this.currentHomeId, objectDestination, "Email"), contactInfo.email);
		this.checkAndSetValue(this.getStatePrefix(this.currentHomeId, objectDestination, "Mobile"), contactInfo.mobile);
	}
}
