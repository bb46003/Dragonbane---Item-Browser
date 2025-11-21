import DragonbaneDataModel from "/systems/dragonbane/modules/data/DragonbaneDataModel.js";
import DoD_Utility from "/systems/dragonbane/modules/utility.js";
import DoDSkillTest from "/systems/dragonbane/modules/tests/skill-test.js";
import { itemsSearch } from "./item-searching.mjs";

export class merchantData extends DragonbaneDataModel {
  static defineSchema() {
    const { fields } = foundry.data;
    return this.mergeSchema(super.defineSchema(), {
      selling_rate: new fields.NumberField({
        required: true,
        initial: 1,
        min: 0.01,
      }),
      buing_rate: new fields.NumberField({
        required: true,
        initial: 0.5,
        min: 0,
      }),
      supply: new fields.StringField({ required: true, initial: "any" }),
      encumbrance: new fields.SchemaField({
        value: new fields.NumberField({
          required: true,
          integer: true,
          initial: 0,
          min: 0,
        }),
      }),
    });
  }
}

const { api, sheets } = foundry.applications;
export class merchant extends api.HandlebarsApplicationMixin(
  sheets.ActorSheetV2,
) {
  /** @inheritDoc */
  static DEFAULT_OPTIONS = {
    classes: ["merchant"],
    position: {
      width: 800,
      height: "auto",
    },
    actions: {
      sellWithBarter: merchant.#rollForBarter,
      sellWithOutBarter: merchant.#sellWithOutBarter,
      openBrowser: merchant.#openBrowser,
      showSortOption: merchant.#showSortOption,
      sort: merchant.#sort,
      openItem: merchant.#openItem,
      changeQunatity: merchant.#changeQuantity,
    },
    actor: {
      type: "merchant",
    },
    form: {
      handler: merchant.myFormHandler,
      submitOnChange: true,
    },
  };
  /** @override */
  static PARTS = {
    body: {
      id: "body",
      template: "modules/dragonbane-item-browser/templates/merchant.hbs",
    },
    tabs: {
      id: "tabs",
      template: "modules/dragonbane-item-browser/templates/tab/tabs.hbs",
    },
    settings: {
      id: "settings",
      template: "modules/dragonbane-item-browser/templates/tab/settings.hbs",
    },
    sellingStuff: {
      id: "sellingStuff",
      template: "modules/dragonbane-item-browser/templates/tab/to-sell.hbs",
    },
    buingStuff: {
      id: "buingStuff",
      template: "modules/dragonbane-item-browser/templates/tab/to-buy.hbs",
    },
  };
  static TABS = {
    sheet: [
      { id: "settings", group: "sheet", label: "DB-IB.merchant.setting" },
      { id: "buingStuff", group: "sheet", label: "DB-IB.merchant.buing" },
      { id: "sellingStuff", group: "sheet", label: "DB-IB.merchant.selling" },
    ],
  };

  #getTabs() {
    const element = this?.element;
    let activeTab = "";
    if (element !== undefined && element !== null) {
      const tabsElements = element.querySelector(".tab.active");
      if (tabsElements !== null) {
        activeTab = tabsElements.dataset.tab;
      }
    }

    const tabs = {};
    for (const [groupId, config] of Object.entries(this.constructor.TABS)) {
      const group = {};
      for (const t of config) {
        const isGM = game.user.isGM;
        let active = false;
        if (isGM && t.id === "settings" && activeTab === "") {
          active = true;
        }
        if (!isGM && t.id === "buingStuff" && activeTab === "") {
          active = true;
        }
        if (activeTab !== "" && t.id === activeTab) {
          active = true;
        }
        group[t.id] = Object.assign(
          { active, cssClass: active ? "active" : "" },
          t,
        );
      }
      tabs[groupId] = group;
    }
    return tabs;
  }
  /** @override */
  async _prepareContext(options) {
    const actorData = await this.getData();
    return actorData;
  }

  async getData() {
    //const source = super.getData();
    const actorData = this.actor.toObject(false);
    const updateActoprData = await deleteSkill(actorData);
    const tabGroups = this.#getTabs();
    const context = {
      tabs: tabGroups.sheet,
      actor: updateActoprData,
      system: updateActoprData.system,
      fields: this.document.system.schema.fields,
      isEditable: this.isEditable,
      source: this.document.toObject(),
      tabGroups,
      tabs: tabGroups.sheet,
      items: updateActoprData.items,
      actorID: this.actor._id,
      dataType: "item",
    };
    async function enrich(html) {
      if (html) {
        return await TextEditor.enrichHTML(html, {
          secrets: context.actor.isOwner,
          async: true,
        });
      } else {
        return html;
      }
    }
    async function deleteSkill(actorData) {
      const actor = game.actors.get(actorData._id);
      const skillsToDelete = actor.items.filter(
        (item) => item.type === "skill",
      );
      const skillIds = skillsToDelete.map((item) => item.id);
      await actor.deleteEmbeddedDocuments("Item", skillIds);
      return actor.toObject();
    }

    return context;
  }
  _updateEncumbrance(sheetData) {
    if (sheetData.actor.type !== "dragonbane-item-browser.merchant") {
      sheetData.encumbrance =
        Math.round(100 * this.actor.system.encumbrance.value) / 100;

      if (this.actor.type === "character") {
        sheetData.overEncumbered =
          sheetData.encumbrance > sheetData.actor.system.maxEncumbrance.value;
      }
    }
  }
  activateListeners(html) {
    const selingSlider = html.querySelector("#slider-selling");
    selingSlider.addEventListener("input", (ev) => this.updateSliderOutput(ev));
    selingSlider.addEventListener("change", (ev) => {
      const newValue = parseFloat(ev.target.value);
      this.actor.update({ "system.selling_rate": newValue });
      const slider = ev.target;
      slider.blur();
    });
    const buyingSlider = html.querySelector("#slider-buing");
    buyingSlider.addEventListener("input", (ev) => this.updateSliderOutput(ev));
    buyingSlider.addEventListener("change", async (ev) => {
      const newValue = parseFloat(ev.target.value);
      await this.actor.update({ "system.buing_rate": newValue });
      const slider = ev.target;
      slider.blur();
    });
    const percentage = html.querySelector("#percentage");
    percentage.addEventListener("change", (ev) => this.textInput(ev));
    const supplySelection = html.querySelector(".supply-selection");
    supplySelection.addEventListener("change", (ev) => this.changeSupply(ev));
    const trash = html.querySelectorAll(".fa.fa-trash");
    if (trash !== null) {
      trash.forEach((icon) => {
        icon.addEventListener("click", (ev) => this.removeFromSelling(ev));
      });
    }

    const coins = html.querySelectorAll(".fas.fa-coins");
    if (coins !== null) {
      coins.forEach((icon) => {
        icon.addEventListener("click", (ev) => this.buyItem(ev));
      });
    }
  }
  async render(force = false, options = {}) {
    await super.render(force, options);
    const el = this.element;
    this.activateListeners(el);
  }
  updateSliderOutput(ev) {
    const slider = ev.target;
    const output = slider.nextElementSibling;
    if (slider && output) {
      const sliderValue = Number(slider.value);
      output.textContent = `${(sliderValue * 100).toFixed(0)}%`;
      const thumbOffset =
        ((sliderValue - Number(slider.min)) /
          (Number(slider.max) - Number(slider.min))) *
          Number(slider.offsetWidth) +
        1.2 * Number(slider.offsetWidth);
      output.style.left = `${thumbOffset}px`;
      output.style.position = "absolute";
      output.style.top = "75%";
    }
  }
  async textInput(ev) {
    const input = ev.target.value;
    const nearestSlider = Array.from(
      ev.currentTarget.parentElement.childNodes,
    ).find((node) => node.tagName === "INPUT" && node.type === "range");
    const systemVaralble = nearestSlider.getAttribute("name");
    const max = Number(nearestSlider.getAttribute("max"));
    const actor = this.actor;
    const regex = /^[1-9]\d*%?$/;
    const regex2 = /^[1-9]\d*%$/;
    const isMatch = regex.test(input);
    if (isMatch) {
      let value = 0;
      if (input.includes("%")) {
        const newinput = input.replace("%", "");
        value = Number(newinput) / 100;
      } else {
        value = Number(input) / 100;
      }
      const isMatch2 = regex2.test(input);
      if (!isMatch2) {
        ev.target.value = input + "%";
      }
      if (value > max) {
        nearestSlider.setAttribute("max", value);
      } else if (value <= 2 && max > 2) {
        nearestSlider.setAttribute("max", 2);
      }
      await actor.update({ [systemVaralble]: value });
    } else {
      const warning = game.i18n.localize("DB-IB.warrning.incoretInput");
      DoD_Utility.WARNING(warning);
      ev.target.value =
        String(Number(actor.system[`${systemVaralble}`]) * 100) + "%";
    }
  }
  async changeSupply(ev) {
    const value = ev.target.value;
    await this.actor.update({ ["system.supply"]: value });
  }
  async _onDropItem(event) {
    event.preventDefault();
    const data = event.dataTransfer;
    const merchant = this.actor;
    if (data) {
      const droppedItem = JSON.parse(data.getData("text/plain"));
      const itemData = await fromUuid(droppedItem.uuid);
      const hasCost =
        itemData?.system?.cost !== undefined && itemData.system.cost !== "";
      if (hasCost) {
        const supplyTypes = ["common", "uncommon", "rare", "any"];
        const index = supplyTypes.indexOf(this.actor.system.supply);
        const itemSuply = supplyTypes.indexOf(itemData.system.supply);
        const itemPriceNoSpace = itemData.system.cost.replace(/\s+/g, "");
        const regex = /^(\d+[Dd]\d+)(x?)(\d*)([a-zA-Z\u0100-\u017F]+)$/;
        if (regex.test(itemPriceNoSpace)) {
          const [dice, multiplyer, currency] = itemPriceNoSpace.match(regex);
          const formula = multiplyer ? `${dice}*${multiplyer}` : dice;
          const costRoll = await new Roll(formula).evaluate();
          const content = game.i18n.format("DB-IB.rollForPrice", {
            formula: formula,
            item: itemData.name,
            currency: currency,
          });
          await costRoll.toMessage({
            user: game.user.id,
            flavor: content,
          });
          const sellingPrice = `${costRoll.total} ${currency}`;
          await itemData.update({ ["system.cost"]: sellingPrice });
        }
        if (droppedItem.uuid.includes("Actor")) {
          const actorID = droppedItem.uuid.split(".")[1];
          await itemData.setFlag("dragonbane-item-browser", "actor", actorID);
          await itemData.setFlag(
            "dragonbane-item-browser",
            "originalID",
            itemData._id,
          );
          const itemAlredyExist = merchant.items.find(
            (item) =>
              item?.flags["dragonbane-item-browser"]?.originalID ===
              itemData._id,
          );
          if (itemAlredyExist !== undefined) {
            DoD_Utility.WARNING(
              game.i18n.localize(
                "DB-IB.merchant.youCannotSellTheSameItemTwice",
              ),
            );
          } else {
            if (itemSuply <= index) {
              if (itemData.system.quantity > 1) {
                const quantity = Array.from(
                  { length: Number(item.system.quantity) },
                  (_, i) => i + 1,
                );
                const html = await DoD_Utility.renderTemplate(
                  "modules/dragonbane-item-browser/templates/dialog/define-quantity.hbs",
                  {
                    item: itemData.name,
                    quantity: quantity,
                  },
                );
                new api.DialogV2({
                  window: {
                    title: game.i18n.localize("DB-IB.dialog.denfieQuantity"),
                  },
                  content: html,
                  buttons: [
                    {
                      action: "sell",
                      label: game.i18n.localize("DB-IB.dialog.sell"),
                      callback: async (event) => {
                        const selectedQuantity =
                          event.currentTarget.querySelector(
                            ".quantity-selector",
                          ).value;
                        const newName = itemData.name + `(${selectedQuantity})`;
                        const oldCost =
                          itemData.system.cost.match(/(\d+)\s*(\w+)/);
                        const newPrice =
                          String(
                            Number(oldCost[1]) * Number(selectedQuantity),
                          ) +
                          " " +
                          oldCost[2];
                        await this.actor.createEmbeddedDocuments("Item", [
                          itemData,
                        ]);
                        const merchantItem = this.actor.items.find(
                          (item) =>
                            item.flags["dragonbane-item-browser"].actor ===
                              actorID && item.name === itemData.name,
                        );
                        await merchantItem.update({
                          ["system.cost"]: newPrice,
                          ["name"]: newName,
                          ["system.quantity"]: selectedQuantity,
                        });
                      },
                    },
                  ],
                }).render(true);
              } else {
                await this.actor.createEmbeddedDocuments("Item", [itemData]);
              }
            } else {
              DoD_Utility.WARNING(
                game.i18n.localize("DB-IB.merchant.notAcceptSuply"),
              );
            }
          }
        } else {
          if (game.user.isGM) {
            const existingItem = this.actor.items.filter((item) => {
              if (item.type === "item" && item.name === itemData.name) {
                return item
              }
              return false;
            });
            if (existingItem.length !== 0) {
              const itemQuantity =
                itemData.system.quantity + existingItem[0].system.quantity;
              return await existingItem[0].update({
                ["system.quantity"]: itemQuantity,
              });
            } else {
              await this.actor.createEmbeddedDocuments("Item", [itemData]);
            }
          } else {
            DoD_Utility.WARNING(
              game.i18n.localize("DB-IB.merchant.nonGMaddItemsToSell"),
            );
          }
        }
      }
    }
  }
  async removeFromSelling(ev) {
    const item = ev.target.closest(".buying-item");
    if (item !== null) {
      const userID = game.user.id;
      const actorID = game.actors.filter((actor) => {
        return actor.ownership[userID] === 3 && actor.type === "character";
      });
      const sellingHeader = ev.target
        .closest(".actor-group")
        .querySelector(".header-row");
      const ownerOfSellingItem = sellingHeader.getAttribute("id");
      let isOwner = false;
      actorID.forEach((actor) => {
        if (actor._id === ownerOfSellingItem) {
          isOwner = true;
        }
      });
      if (isOwner) {
        const ID = item.getAttribute("id");
        await this.actor.deleteEmbeddedDocuments("Item", [ID]);
      } else {
        DoD_Utility.WARNING(
          game.i18n.localize("DB-IB.warrning.youAreNotOwnerOfDeletedItem"),
        );
      }
    } else {
      const itemID = ev.target.id;
      await this.actor.deleteEmbeddedDocuments("Item", [itemID]);
    }
  }
  static async #sellWithOutBarter(ev) {
    const actorGroups = document.querySelectorAll(".actor-group");
    const result = {};
    const coinsType = [
      game.i18n.translations.DoD.currency.gold.toLowerCase(),
      "gold",
      game.i18n.translations.DoD.currency.silver.toLowerCase(),
      "silver",
      game.i18n.translations.DoD.currency.copper.toLowerCase(),
      "copper",
    ];
    actorGroups.forEach((group) => {
      const header = group.querySelector(".header-row");
      const headerID = header.id;
      const items = group.querySelectorAll(".buying-item");
      const itemsData = Array.from(items).map((item) => {
        const itemID = item.id;
        const name = item.querySelector("label:not(.price-label)").innerText;
        const price = item.querySelector(".price-label").innerText.trim();
        return { id: itemID, price: price, name: name };
      });
      result[headerID] = itemsData;
    });
    Object.keys(result).forEach(async (headerID) => {
      let totalPrice = 0;
      let allItemName = "";
      const sellingActor = game.actors.get(headerID);
      const user = game.user.id;
      result[headerID].forEach(async (item) => {
        const priceMatch = item.price.match(/^([\d.]+)\s*([a-zA-Z]+)$/);
        if (priceMatch) {
          const price = Math.round(Number(priceMatch[1]) * 10) / 10;
          const coninType = priceMatch[2];
          let currencyType = coinsType.indexOf(coninType);
          switch (currencyType) {
            case 0:
            case 1:
              totalPrice += price * 100;
              break;
            case 2:
            case 3:
              totalPrice += price * 10;
              break;
            case 3:
            case 4:
              totalPrice += price;
              break;
          }
          if (allItemName !== "") {
            allItemName += ", ";
          }
          allItemName += item.name;
          const sellingItem = await this.actor.items.find(
            (element) => element.id === item.id,
          );
          if (sellingActor.ownership[user] === 3) {
            this.actor.deleteEmbeddedDocuments("Item", [item.id]);
            const removerdItem = await sellingActor.items.find(
              (item) =>
                item.id ===
                sellingItem.flags["dragonbane-item-browser"].originalID,
            );

            if (sellingItem.system.quantity === removerdItem.system.quantity) {
              sellingActor.deleteEmbeddedDocuments("Item", [removerdItem._id]);
            } else {
              removerdItem.update({
                ["system.quantity"]:
                  removerdItem.system.quantity - sellingItem.system.quantity,
              });
            }
          }
        }
      });
      const sellingPrice = totalPrice;
      const goldPart = Math.floor(sellingPrice / 100);
      const silverPart = Math.floor((sellingPrice % 100) / 10);
      const copperPart = Math.round(sellingPrice % 10);
      let actorGC = sellingActor.system.currency.gc;
      let actorSC = sellingActor.system.currency.sc;
      let actorCC = sellingActor.system.currency.cc;
      if (sellingActor.ownership[user] === 3) {
        await sellingActor.update({
          ["system.currency.gc"]: actorGC + goldPart,
          ["system.currency.sc"]: actorSC + silverPart,
          ["system.currency.cc"]: actorCC + copperPart,
        });
        const content = await DoD_Utility.renderTemplate(
          "modules/dragonbane-item-browser/templates/chat/sell-with-merchant.hbs",
          {
            copperPart: copperPart,
            silverPart: silverPart,
            goldPart: goldPart,
            actor: sellingActor.name,
            items: allItemName,
          },
        );
        ChatMessage.create({
          content: content,
        });
      }
    });
  }
  async buyItem(ev) {
    const rollForBarter = game.settings.get(
      "dragonbane-item-browser",
      "barter-roll-when-buys",
    );
    const user = game.user;
    const itemID = ev.target.id;
    const item = this.actor.items.get(itemID);
    const itemDiv = ev.target.closest(".selling-item");
    const priceLabel = itemDiv.querySelector(".price-label").textContent.trim();
    const coinsType = [
      game.i18n.translations.DoD.currency.gold.toLowerCase(),
      "gold",
      game.i18n.translations.DoD.currency.silver.toLowerCase(),
      "silver",
      game.i18n.translations.DoD.currency.copper.toLowerCase(),
      "copper",
    ];
    const priceMatch = priceLabel.match(/^([\d.]+)\s*([a-zA-Z]+)$/);
    const coinType = priceMatch[2];
    let sellingPrice;
    let currencyType;
    let userActor;
    const merchantActor = this.actor;
    if (user.isGM) {
      const characters = game.actors.filter(
        (actor) => actor.type === "character",
      );

      const content = await DoD_Utility.renderTemplate(
        "modules/dragonbane-item-browser/templates/dialog/chose-actor.hbs",
        { actors: characters },
      );
      userActor = await new Promise((resolve) => {
        new api.DialogV2({
          window: { title: game.i18n.localize("DB-IB.dialog.selectActor") },
          content: content,
          buttons: [
            {
              action: "select",
              label: game.i18n.localize("DB-IB.dialog.buy"),
              callback: async (event) => {
                const selectedActorId =
                  event.currentTarget.querySelector("select").value;
                const selectedActor = game.actors.get(selectedActorId);
                resolve(selectedActor);
              },
            },
          ],
        }).render(true);
      });

      if (!userActor) return;
    } else {
      userActor = user.character;
    }

    if (!userActor) {
      ui.notifications.error("No valid character selected.");
      return;
    }
    sellingPrice = Number(priceMatch[1]);
    currencyType = coinsType.indexOf(coinType);

    if (rollForBarter) {
      let skillName = game.settings.get(
        "dragonbane-item-browser",
        "custom-barter-skill",
      );
      if (skillName === "") {
        skillName = "Bartering";
      }
      let skill = userActor.findSkill(skillName);
      if (skill === undefined && skillName !== "Bartering") {
        skill = userActor.findSkill("Bartering");
      }
      let selector = "";
      if(item.system.quantity >1){
        
      }
      const options = {};
      const test = new DoDSkillTest(userActor, skill, options);
      const d = new api.DialogV2({
        window: { title: game.i18n.localize("DB-IB.wannaBarter") },
        content: game.i18n.localize("DB-IB.pickIfYouWantToRollForBartering"),
        buttons: [
          {
            action: "buyWithRoll",
            label: game.i18n.localize("DB-IB.rollForBarter"),
            callback: async () => {
              const barterSkillRoll = await test.roll();
              if (barterSkillRoll !== undefined) {
                const success = barterSkillRoll.postRollData.success;
                const isDemon = barterSkillRoll.postRollData.isDemon;
                const isDragon = barterSkillRoll.postRollData.isDragon;
                const canPush = barterSkillRoll.postRollData.canPush;
                const ChatMessage = barterSkillRoll.rollMessage._id;
                let existingMessage = game.messages.get(ChatMessage);

                if (canPush) {
                  await barterPushButton(existingMessage);
                  existingMessage = game.messages.get(ChatMessage);
                }
                await addBuyButton(
                  item,
                  userActor,
                  success,
                  isDemon,
                  isDragon,
                  existingMessage,
                  ChatMessage,
                  barterSkillRoll,
                  priceLabel,
                  merchantActor,
                );
              }
            },
            default: true,
          },
          {
            action: "buyWithoutRoll",
            label: game.i18n.localize("DB-IB.BuyWithoutRoll"),
            callback: async () => {
              await this.spendMony(
                currencyType,
                sellingPrice,
                userActor,
                item,
                merchantActor,
                itemID,
                priceLabel,
              );
            },
          },
        ],
      });
      d.render(true);
    } else {
      await this.spendMony(
        currencyType,
        sellingPrice,
        userActor,
        item,
        merchantActor,
        itemID,
        priceLabel,
      );
    }
  }
  async spendMony(
    currencyType,
    sellingPrice,
    userActor,
    item,
    merchantActor,
    itemID,
    priceLabel,
  ) {
    switch (currencyType) {
      case 0:
      case 1:
        sellingPrice *= 100;
        break;
      case 2:
      case 3:
        sellingPrice *= 10;
        break;
      case 4:
      case 5:
        sellingPrice = sellingPrice;
        break;
    }

    const goldPart = Math.floor(sellingPrice / 100);
    const silverPart = Math.floor((sellingPrice % 100) / 10);
    const copperPart = Math.round(sellingPrice % 10);

    let actorGC = userActor.system.currency.gc;
    let actorSC = userActor.system.currency.sc;
    let actorCC = userActor.system.currency.cc;

    const totalMoney = actorGC * 100 + actorSC * 10 + actorCC;
    const totalItemPrice = goldPart * 100 + silverPart * 10 + copperPart;

    if (totalMoney < totalItemPrice) {
      ChatMessage.create({
        content: game.i18n.format("DB-IB.notEnoughMoney", {
          actor: userActor.name,
          item: item.name,
        }),
        speaker: ChatMessage.getSpeaker({ actor: userActor }),
      });
      return;
    } else {
      // Deduct money correctly
      let newGold = actorGC - goldPart;
      let newSilver = actorSC - silverPart;
      let newCopper = actorCC - copperPart;

      while (newGold < 0) {
        actorSC -= 10;
        if (actorSC >= 0) newGold++;
        else {
          actorCC -= 100;
          newGold++;
        }
      }
      while (newSilver < 0) {
        actorGC -= 1;
        if (actorGC >= 0) {
          newSilver += 10;
          actorSC += 10;
        } else {
          actorCC -= 10;
          newSilver += 1;
          actorSC += 1;
        }
      }
      while (newCopper < 0) {
        actorSC -= 1;
        if (actorSC >= 0) {
          newCopper += 10;
          actorCC += 10;
        } else {
          actorGC -= 1;
          newCopper += 100;
          actorCC += 100;
        }
      }

      await userActor.update({
        "system.currency.gc": actorGC - goldPart,
        "system.currency.sc": actorSC - silverPart,
        "system.currency.cc": actorCC - copperPart,
      });

      await userActor.createEmbeddedDocuments("Item", [item]);

      if (item.system.quantity > 1) {
        await item.update({ "system.quantity": item.system.quantity - 1 });
      } else {
        await merchantActor.deleteEmbeddedDocuments("Item", [itemID]);
      }

      ChatMessage.create({
        content: game.i18n.format("DB-IB.spendMoney", {
          actor: userActor.name,
          item: item.name,
          itemPrice: priceLabel,
        }),
        speaker: ChatMessage.getSpeaker({ actor: userActor }),
      });
    }
  }
  static async #rollForBarter(ev) {
    let userActor;
    let characters = {};
    if (game.user.isGM) {
      const actorGroups = document.querySelectorAll(".actor-group");
      actorGroups.forEach((group) => {
        const header = group.querySelector(".header-row");
        const headerID = header.id;
        characters[headerID] = game.actors.get(headerID);
      });
      if (Object.keys(characters).length > 1) {
        const content = await DoD_Utility.renderTemplate(
          "modules/dragonbane-item-browser/templates/dialog/chose-actor.hbs",
          { actors: characters },
        );
        userActor = await new Promise((resolve) => {
          new api.DialogV2({
            window: { title: game.i18n.localize("DB-IB.dialog.selectActor") },
            content: content,
            buttons: [
              {
                action: "select",
                label: game.i18n.localize("DB-IB.dialog.buy"),
                callback: async (event) => {
                  const selectedActorId =
                    event.currentTarget.querySelector("select").value;
                  const selectedActor = game.actors.get(selectedActorId);
                  resolve(selectedActor);
                },
              },
            ],
          }).render(true);
        });

        if (!userActor) return;
      } else {
        const singleActorId = Object.keys(characters)[0];
        userActor = characters[singleActorId];
      }
    } else {
      userActor = game.user.character;
    }
    let skillName = game.settings.get(
      "dragonbane-item-browser",
      "custom-barter-skill",
    );
    if (skillName === "") {
      skillName = "Bartering";
    }
    let skill = userActor.findSkill(skillName);
    if (skill === undefined && skillName !== "Bartering") {
      skill = userActor.findSkill("Bartering");
    }
    let items = {};
    const actorGroups = document.querySelectorAll(".actor-group");
    actorGroups.forEach((group) => {
      const header = group.querySelector(".header-row");
      const headerID = header.id;
      if (headerID === userActor._id) {
        const itemsForSell = group.querySelectorAll(".buying-item");
        const itemsData = Array.from(itemsForSell).map((item) => {
          const itemID = item.id;
          const name = item.querySelector("label:not(.price-label)").innerText;
          const price = item.querySelector(".price-label").innerText.trim();
          return { id: itemID, price: price, name: name };
        });
        items[headerID] = itemsData;
      }
    });
    if (Object.keys(items).length > 0) {
      const options = {};
      const test = new DoDSkillTest(userActor, skill, options);
      const barterSkillRoll = await test.roll();
      if (barterSkillRoll !== undefined) {
        const success = barterSkillRoll.postRollData.success;
        const isDemon = barterSkillRoll.postRollData.isDemon;
        const isDragon = barterSkillRoll.postRollData.isDragon;
        const canPush = barterSkillRoll.postRollData.canPush;
        barterSkillRoll["system.items"] = items; //},{"system.merchant":this.actor})

        const ChatMessage = barterSkillRoll.rollMessage._id;

        let existingMessage = game.messages.get(ChatMessage);

        if (canPush) {
          await barterSellPushButton(existingMessage);
          existingMessage = game.messages.get(ChatMessage);
        }
        const merchantActor = this.actor;
        await addSellButton(
          items,
          userActor,
          success,
          isDemon,
          isDragon,
          existingMessage,
          ChatMessage,
          barterSkillRoll,
          merchantActor,
        );
      }
    } else {
      DoD_Utility.WARNING(
        game.i18n.localize("DB-IB.warrning.youDoNotSellAnything"),
      );
    }
  }
  static async myFormHandler(ev, b, object) {
    const target = ev.target;
    const edit = target.dataset.edit;
    const newValue = target.value;
    if (edit === "name") {
      await this.actor.update({ [edit]: newValue });
    }
    const img = object.object.img;
    if (img !== "") {
      await this.actor.update({ img: img });
    }
  }
  static async #openBrowser(ev) {
    const target = ev.target;
    const itemType = target.dataset.type;
    const actorID = target.id;
    const filterData = { chosenType: itemType };
    const browser = new itemsSearch(filterData, actorID);
    browser.openBrowser(filterData, actorID, "merchant");
  }
  static async #showSortOption(ev) {
    const target = ev.target;
    const sortOption = target.nextElementSibling;
    if( sortOption.style.display === "flex"){
       sortOption.style.display = "none";
    }
    else{
    sortOption.style.display = "flex";
    sortOption.style.flexDirection = "column"
    }
  }
  static async #sort(ev) {
    const target = ev.target;
    const sortType = target.dataset.sort;
    const form = target.closest("form");
    const items = Array.from(form.querySelectorAll(".selling-item"));
    const priceToCopper = (priceString) => {
      if (!priceString) return 0;
      const text = priceString.toLowerCase();

      const coins = [
        {
          words: [
            game.i18n.translations.DoD.currency.gold.toLowerCase(),
            "gold",
          ],
          value: 10000,
        },
        {
          words: [
            game.i18n.translations.DoD.currency.silver.toLowerCase(),
            "silver",
          ],
          value: 100,
        },
        {
          words: [
            game.i18n.translations.DoD.currency.copper.toLowerCase(),
            "copper",
          ],
          value: 1,
        },
      ];

      let total = 0;
      for (const { words, value } of coins) {
        const regex = new RegExp(
          `(\\d+(?:\\.\\d+)?)\\s*(${words.join("|")})`,
          "i",
        );
        const match = text.match(regex);
        if (match) total += parseFloat(match[1]) * value;
      }
      return total;
    };

    const compare = (a, b) => {
      switch (sortType) {
        case "name":
          return a.dataset.name.localeCompare(b.dataset.name, undefined, {
            sensitivity: "base",
          });
        case "type":
          return a.dataset.type.localeCompare(b.dataset.type, undefined, {
            sensitivity: "base",
          });
        case "cost":
          return (
            priceToCopper(b.dataset.price) - priceToCopper(a.dataset.price)
          );
        default:
          return 0;
      }
    };

    const sorted = items.sort(compare);
    const container = form.querySelector(".item-group");
    sorted.forEach((el) => container.appendChild(el));
    const sortOption = form.querySelector(".dropdown-list");
    sortOption.style.display = "none";
  }
  static async #openItem(ev){
    if(game.user.isGM){
    const target = ev.target;
    const itemDiv = target.closest("div");
    const itemID = itemDiv.id
    const item = this.actor.items.get(itemID);
    item.sheet.render(true)
    }
  }
  static async #changeQuantity(ev){
    const target = ev.target;
    const itemDiv = target.closest("div");
    const itemID = itemDiv.id
    const action = target.dataset.type;
    const item = this.actor.items.get(itemID);
    const quantity = item.system.quantity;
    if(action === "up"){
      await item.update({["system.quantity"]:quantity + 1})
    }
    else{
      if((quantity - 1) === 0 ){
          await this.actor.deleteEmbeddedDocuments("Item", [item.id]);
      }else{
        await item.update({["system.quantity"]:quantity - 1})
      }
  }
}
}
async function barterPushButton(existingMessage) {
  let tempDiv = document.createElement("div");
  tempDiv.innerHTML = existingMessage.content;
  let button = tempDiv.querySelector("button.push-roll");
  if (button) {
    button.classList.remove("push-roll");
    button.classList.add("merchat-barter-push-roll");
  }
  let updatedContent = tempDiv.innerHTML;
  existingMessage.content = updatedContent;
  existingMessage.update({ content: updatedContent });
}
async function addBuyButton(
  item,
  actor,
  sucess,
  isDemon,
  isDragon,
  existingMessage,
  ChatMessage,
  barterSkillRoll,
  priceLabel,
  merchantActor,
) {
  let flavor = existingMessage.flavor;
  let newFlavor = "";
  if (sucess && !isDragon) {
    const tekst = game.i18n.format("DB-IB.Chat.reducePrice", {
      item: item.name,
    });
    const reducePrice = `<br><p> ${tekst}</p>`;
    newFlavor = flavor + reducePrice;
  } else if (isDemon) {
    const tekst = game.i18n.format("DB-IB.Chat.cannotBuy", { item: item.name });
    const cannotBuy = `<br><p> ${tekst}</p>`;
    newFlavor = flavor + cannotBuy;
  } else if (isDragon) {
    const tekst = game.i18n.format("DB-IB.Chat.reducePriceDragon", {
      item: item.name,
    });
    const reducePriceDragon = `<br><p> ${tekst}</p>`;
    newFlavor = flavor + reducePriceDragon; // Keep </span> and add reducePrice after it
  } else {
    const tekst = game.i18n.format("DB-IB.Chat.nochangeInPrice", {
      item: item.name,
    });
    const regularPrice = `<br><p> ${tekst}</p>`;
    newFlavor = flavor + regularPrice;
  }
  if (isDemon === false) {
    const newButton = `
        <button type="button" class="chat-button buy-item-merchat" data-message-id="${ChatMessage}">
        ${game.i18n.format("DB-IB.Chat.buyItem")}
         </button>
        `;
    let updatedContent = `${existingMessage.content} <div>${newButton}</div>`;
    existingMessage.update({
      content: updatedContent,
      flavor: newFlavor,
      system: { actor, item, barterSkillRoll, priceLabel, merchantActor },
    });
  } else {
    existingMessage.update({
      flavor: newFlavor,
      system: { actor, item, barterSkillRoll, priceLabel },
    });
  }
}
/*
async function barterPushRoll(event) {
    const ChatMessageID = event.target.closest('[data-message-id]')?.getAttribute('data-message-id');
    const currentMessage =  game.messages.get(ChatMessageID);
    const formula = currentMessage.rolls[0]._formula;
    const actor = game.actors.get(currentMessage.system.actor._id);
    
    const element = event.currentTarget;
        const parent = element.parentElement;
        const pushChoices = parent.getElementsByTagName("input");
        const choice = Array.from(pushChoices).find(e => e.name==="pushRollChoice" && e.checked);
        if (!actor.hasCondition(choice.value)) {
           actor.updateCondition(choice.value, true);
           await creatConditionMagade(actor,choice)
        } else {
            DoD_Utility.WARNING("DoD.WARNING.conditionAlreadyTaken");
            return;
        }
        let skillName =  game.settings.get("dragonbane-item-browser","custom-barter-skill")
        if (skillName === ""){
            skillName = "Bartering"
        }
        let skill = actor.findSkill(skillName)
        if (skill === undefined && skill !== "Bartering"){
            skill = actor.findSkill("Bartering")
        }
       
        let options = {canPush:false,skipDialog: true, formula:formula};
        const test = new DoDSkillTest(actor, skill, options);
        const barterSkillRoll = await test.roll();
        const sucess = barterSkillRoll.postRollData.success;
        const isDemon = barterSkillRoll.postRollData.isDemon;
        const isDragon = barterSkillRoll.postRollData.isDragon;
        const ChatMessage = barterSkillRoll.rollMessage._id;
        let existingMessage = game.messages.get(ChatMessage);
        const priceLabel = currentMessage.system.priceLabel;
        const merchantActor = game.actors.get(ChatMessage.system.merchantActor._id);
        const items= merchantActor.items.get(ChatMessage.system.items);
        await addBuyButton(items ,actor, sucess, isDemon, isDragon, existingMessage, ChatMessage, barterSkillRoll, priceLabel, merchantActor)
    
}
        */
async function creatConditionMagade(actor, choice) {
  const msg = game.i18n.format("DoD.ui.chat.takeCondition", {
    actor: actor.name,
    condition: game.i18n.localize("DoD.conditions." + choice.value),
  });
  ChatMessage.create({
    content: msg,
    user: game.user.id,
    speaker: ChatMessage.getSpeaker({ actor: actor }),
  });
}
/*
async function  buyFromChat(event) {
    const ChatMessage =  game.messages.get(event.target.getAttribute("data-message-id"));
    console.log(ChatMessage)
}
    */
async function addSellButton(
  items,
  userActor,
  sucess,
  isDemon,
  isDragon,
  existingMessage,
  ChatMessage,
  barterSkillRoll,
  merchantActor,
) {
  let flavor = existingMessage.flavor;
  let newFlavor = "";
  const sellsItem = items[userActor._id].map((item) => item.name).join(", ");
  const priceLabel = combinePrice(items[userActor._id]);
  if (sucess && !isDragon) {
    const tekst = game.i18n.format("DB-IB.Chat.increasPrice", {
      item: sellsItem,
    });
    const reducePrice = `<br><p> ${tekst}</p>`;
    newFlavor = flavor + reducePrice;
  } else if (isDemon) {
    const tekst = game.i18n.format("DB-IB.Chat.cannotSell", {
      item: sellsItem,
    });
    const cannotBuy = `<br><p> ${tekst}</p>`;
    newFlavor = flavor + cannotBuy;
    const merchant = await game.actors.get(merchantActor._id);
    items[userActor._id].forEach(async (item) => {
      await merchant.deleteEmbeddedDocuments("Item", [item.id]);
    });
  } else if (isDragon) {
    const tekst = game.i18n.format("DB-IB.Chat.increasePriceDragon", {
      item: sellsItem,
    });
    const reducePriceDragon = `<br><p> ${tekst}</p>`;
    newFlavor = flavor + reducePriceDragon; // Keep </span> and add reducePrice after it
  } else {
    const tekst = game.i18n.format("DB-IB.Chat.nochangeInPriceSell", {
      item: sellsItem,
    });
    const regularPrice = `<br><p> ${tekst}</p>`;
    newFlavor = flavor + regularPrice;
  }
  if (isDemon === false) {
    const newButton = `
        <button type="button" class="chat-button sell-item-merchat" data-message-id="${ChatMessage}">
        ${game.i18n.localize("DB-IB.Chat.sellItemButton")}
         </button>
        `;
    let updatedContent = `${existingMessage.content} <div>${newButton}</div>`;
    existingMessage.update({
      content: updatedContent,
      flavor: newFlavor,
      system: { userActor, items, barterSkillRoll, priceLabel, merchantActor },
    });
  } else {
    existingMessage.update({
      flavor: newFlavor,
      system: { userActor, items, barterSkillRoll, priceLabel },
    });
  }
}
async function combinePrice(items) {
  let cost = 0;
  let finalCost = "";
  const coinsType = [
    game.i18n.translations.DoD.currency.gold.toLowerCase(),
    "gold",
    game.i18n.translations.DoD.currency.silver.toLowerCase(),
    "silver",
    game.i18n.translations.DoD.currency.copper.toLowerCase(),
    "copper",
  ];
  const totalPrice = items.reduce((cost, item) => {
    const priceMatch = item.price.match(/^([\d.]+)\s*([a-zA-Z]+)$/);
    if (!priceMatch) return cost;

    const coinType = priceMatch[2];
    let currencyType = coinsType.indexOf(coinType);
    let buyingCost = Number(priceMatch[1]);

    switch (currencyType) {
      case 0:
      case 1:
        buyingCost *= 100;
        break;
      case 2:
      case 3:
        buyingCost *= 10;
        break;
      case 4:
      case 5:
        break;
    }

    return cost + buyingCost;
  }, 0);
  const goldPart = Math.floor(totalPrice / 100);
  const silverPart = Math.floor((totalPrice % 100) / 10);
  const copperPart = Math.round(totalPrice % 10);
  let i = 1;
  if (game.i18n.lang === "en") {
    i = 1;
  } else {
    i = 0;
  }
  if (goldPart !== 0) {
    finalCost = String(goldPart) + " " + coinsType[i];
  }
  if (goldPart === 0 && silverPart !== 0 && copperPart === 0) {
    finalCost = String(silverPart) + " " + coinsType[i + 2];
  }
  if (goldPart === 0 && silverPart === 0 && copperPart !== 0) {
    finalCost = String(copperPart) + " " + coinsType[i + 4];
  }
  if (
    (goldPart !== 0 && silverPart !== 0 && copperPart === 0) ||
    (goldPart !== 0 && silverPart !== 0 && copperPart !== 0)
  ) {
    finalCost += ", " + String(silverPart) + " " + coinsType[i + 2];
  }
  if (
    ((goldPart === 0 && silverPart !== 0) ||
      (goldPart !== 0 && silverPart === 0) ||
      (goldPart !== 0 && silverPart !== 0)) &&
    copperPart !== 0
  ) {
    finalCost += ", " + String(copperPart) + " " + coinsType[i + 4];
  }
  return finalCost;
}
async function barterSellPushButton(existingMessage) {
  let tempDiv = document.createElement("div");
  tempDiv.innerHTML = existingMessage.content;
  let button = tempDiv.querySelector("button.push-roll");
  if (button) {
    button.classList.remove("push-roll");
    button.classList.add("merchat-barter-push-roll");
  }
  let updatedContent = tempDiv.innerHTML;
  existingMessage.content = updatedContent;
  existingMessage.update({ content: updatedContent });
}

export class sellingItemMerchat {
  constructor({ itemID, actorID }) {
    this.itemID = itemID;
    this.actorID = actorID;
  }
  async addChatListeners(_app, html, _data) {
    if (game.release.generation < 13) {
      html.on(
        "click",
        ".chat-button.buy-item-merchat",
        this.buyFromChat.bind(this),
      );
      html.on(
        "click",
        ".merchat-barter-push-roll",
        this.barterPushRoll.bind(this),
      );
      html.on(
        "click",
        ".chat-button.sell-item-merchat",
        this.sellFromChat.bind(this),
      );
    } else {
      DoD_Utility.addHtmlEventListener(
        html,
        "click",
        ".chat-button.buy-item-merchat",
        this.buyFromChat.bind(this),
      );
      DoD_Utility.addHtmlEventListener(
        html,
        "click",
        ".merchat-barter-push-roll",
        this.barterPushRoll.bind(this),
      );
      DoD_Utility.addHtmlEventListener(
        html,
        "click",
        ".chat-button.sell-item-merchat",
        this.sellFromChat.bind(this),
      );
    }
  }
  async barterPushButton(existingMessage) {
    let tempDiv = document.createElement("div");
    tempDiv.innerHTML = existingMessage.content;
    let button = tempDiv.querySelector("button.push-roll");
    if (button) {
      button.classList.remove("push-roll");
      button.classList.add("merchat-barter-push-roll");
    }
    let updatedContent = tempDiv.innerHTML;
    existingMessage.content = updatedContent;
    existingMessage.update({ content: updatedContent });
  }
  async addBuyButton(
    item,
    actor,
    sucess,
    isDemon,
    isDragon,
    existingMessage,
    ChatMessage,
    barterSkillRoll,
    priceLabel,
  ) {
    let flavor = existingMessage.flavor;
    let newFlavor = "";
    if (sucess) {
      const tekst = game.i18n.format("DB-IB.Chat.reducePrice", {
        item: item.name,
      });
      const reducePrice = `<br><p> ${tekst}</p>`;
      newFlavor = flavor + reducePrice;
    } else if (isDemon) {
      const tekst = game.i18n.format("DB-IB.Chat.cannotBuy", {
        item: item.name,
      });
      const cannotBuy = `<br><p> ${tekst}</p>`;
      newFlavor = flavor + cannotBuy;
    } else if (isDragon) {
      const tekst = game.i18n.format("DB-IB.Chat.reducePriceDragon", {
        item: item.name,
      });
      const reducePriceDragon = `<br><p> ${tekst}</p>`;
      newFlavor = flavor + reducePriceDragon;
    } else {
      const tekst = game.i18n.format("DB-IB.Chat.nochangeInPrice", {
        item: item.name,
      });
      const regularPrice = `<br><p> ${tekst}</p>`;
      newFlavor = flavor + regularPrice;
    }
    if (isDemon === false) {
      const newButton = `
        <button type="button" class="chat-button buy-item-merchat" data-message-id="${ChatMessage}">
        ${game.i18n.format("DB-IB.Chat.buyItem")}
         </button>
        `;
      let updatedContent = `${existingMessage.content} <div>${newButton}</div>`;
      existingMessage.update({
        content: updatedContent,
        flavor: newFlavor,
        system: { actor, item, barterSkillRoll, priceLabel },
      });
    } else {
      existingMessage.update({
        flavor: newFlavor,
        system: { actor, item, barterSkillRoll, priceLabel },
      });
    }
  }
  async barterPushRoll(event) {
    const ChatMessageID = event.target
      .closest("[data-message-id]")
      ?.getAttribute("data-message-id");
    const currentMessage = game.messages.get(ChatMessageID);
    const formula = currentMessage.rolls[0]._formula;
    let options = currentMessage.rolls[0].options;
    const userActor = game.actors.get(currentMessage.system.actor._id);
    const priceLabel = currentMessage.system.priceLabel;
    const element = event.currentTarget;
    const parent = element.parentElement;
    const pushChoices = parent.getElementsByTagName("input");
    const choice = Array.from(pushChoices).find(
      (e) => e.name === "pushRollChoice" && e.checked,
    );
    if (!userActor.hasCondition(choice.value)) {
      userActor.updateCondition(choice.value, true);
      await creatConditionMagade(userActor, choice);
    } else {
      DoD_Utility.WARNING("DoD.WARNING.conditionAlreadyTaken");
      return;
    }
    let skillName = game.settings.get(
      "dragonbane-item-browser",
      "custom-barter-skill",
    );
    if (skillName === "") {
      skillName = "Bartering";
    }
    let skill = userActor.findSkill(skillName);
    if (skill === undefined && skill !== "Bartering") {
      skill = userActor.findSkill("Bartering");
    }
    if (options.boons) {
      options.boons = options.boons.filter((boon) => boon.value !== false);
    }
    if (options.banes) {
      options.banes = options.banes.filter((bane) => bane.value !== false);
    }
    options = {
      ...options,
      canPush: false,
      skipDialog: true,
      formula: formula,
    };
    const test = new DoDSkillTest(userActor, skill, options);
    const barterSkillRoll = await test.roll();
    const sucess = barterSkillRoll.postRollData.success;
    const isDemon = barterSkillRoll.postRollData.isDemon;
    const isDragon = barterSkillRoll.postRollData.isDragon;
    const ChatMessage = barterSkillRoll.rollMessage._id;
    const merchantActor = game.actors.get(
      currentMessage.system.merchantActor._id,
    );
    const items = currentMessage.system.item;
    let existingMessage = game.messages.get(ChatMessage);
    await addSellButton(
      items,
      userActor,
      sucess,
      isDemon,
      isDragon,
      existingMessage,
      ChatMessage,
      barterSkillRoll,
      merchantActor,
    );
  }
  async creatConditionMagade(actor, choice) {
    const msg = game.i18n.format("DoD.ui.chat.takeCondition", {
      actor: actor.name,
      condition: game.i18n.localize("DoD.conditions." + choice.value),
    });
    ChatMessage.create({
      content: msg,
      user: game.user.id,
      speaker: ChatMessage.getSpeaker({ actor: actor }),
    });
  }
  async buyFromChat(event) {
    const ChatMessage = game.messages.get(
      event.target.getAttribute("data-message-id"),
    );
    const priceLabel = ChatMessage.system.priceLabel;
    const priceMatch = priceLabel.match(/^([\d.]+)\s*([a-zA-Z]+)$/);
    const coinType = priceMatch[2];
    const rollResults = ChatMessage.system.barterSkillRoll.postRollData.success;
    const isDragon = ChatMessage.system.barterSkillRoll.postRollData.isDragon;
    let cost = priceMatch[1];
    if (rollResults === false) {
      cost = cost;
    } else if (rollResults === true && isDragon === false) {
      cost = cost * 0.8;
      cost = Math.round(cost * 100) / 100;
    } else if (rollResults === true && isDragon === true) {
      cost = cost * 0.5;
      cost = Math.round(cost * 100) / 100;
    }
    const coinsType = [
      game.i18n.translations.DoD.currency.gold.toLowerCase(),
      "gold",
      game.i18n.translations.DoD.currency.silver.toLowerCase(),
      "silver",
      game.i18n.translations.DoD.currency.copper.toLowerCase(),
      "copper",
    ];

    const currencyType = coinsType.indexOf(coinType);
    const userActor = game.actors.get(ChatMessage.system.actor._id);
    const merchantActor = game.actors.get(ChatMessage.system.merchantActor._id);
    const item = merchantActor.items.get(ChatMessage.system.item._id);
    if (item === undefined) {
      DoD_Utility.WARNING(
        game.i18n.format("DB-IB.warrning.merchantDoNotHaveMoreItem", {
          itemName: ChatMessage.system.item.name,
        }),
      );
    } else {
      const itemID = item.id;
      this.spendMony(
        currencyType,
        cost,
        userActor,
        item,
        merchantActor,
        itemID,
        priceLabel,
      );
    }
  }
  async spendMony(
    currencyType,
    sellingPrice,
    userActor,
    item,
    merchantActor,
    itemID,
    priceLabel,
  ) {
    switch (currencyType) {
      case 0:
      case 1:
        sellingPrice *= 100;
        break;
      case 2:
      case 3:
        sellingPrice *= 10;
        break;
      case 4:
      case 5:
        sellingPrice = sellingPrice;
        break;
    }

    const goldPart = Math.floor(sellingPrice / 100);
    const silverPart = Math.floor((sellingPrice % 100) / 10);
    const copperPart = Math.round(sellingPrice % 10);
    priceLabel = "";
    if (goldPart !== 0) {
      priceLabel =
        String(goldPart) +
        " " +
        game.i18n.translations.DoD.currency.gold.toLowerCase();
    }
    if (goldPart !== 0 && silverPart !== 0 && copperPart === 0) {
      priceLabel += game.i18n.localize("DB-IB.Chat.and");
      priceLabel +=
        " " +
        String(silverPart) +
        " " +
        game.i18n.translations.DoD.currency.silver.toLowerCase();
    }
    if (goldPart !== 0 && silverPart !== 0 && copperPart !== 0) {
      priceLabel += game.i18n.localize("DB-IB.Chat.and");
      priceLabel +=
        " " +
        String(silverPart) +
        " " +
        game.i18n.translations.DoD.currency.silver.toLowerCase();
    }
    if (goldPart === 0 && silverPart !== 0) {
      priceLabel +=
        String(silverPart) +
        " " +
        game.i18n.translations.DoD.currency.silver.toLowerCase();
    }
    if (
      (goldPart !== 0 && silverPart !== 0 && copperPart !== 0) ||
      (goldPart === 0 && silverPart !== 0 && copperPart !== 0) ||
      (goldPart !== 0 && silverPart === 0 && copperPart !== 0)
    ) {
      priceLabel += game.i18n.localize("DB-IB.Chat.and");
      priceLabel +=
        " " +
        String(copperPart) +
        " " +
        game.i18n.translations.DoD.currency.copper.toLowerCase();
    }
    if (goldPart === 0 && silverPart === 0 && copperPart !== 0) {
      priceLabel +=
        String(copperPart) +
        " " +
        game.i18n.translations.DoD.currency.copper.toLowerCase();
    }

    let actorGC = userActor.system.currency.gc;
    let actorSC = userActor.system.currency.sc;
    let actorCC = userActor.system.currency.cc;

    const totalMoney = actorGC * 100 + actorSC * 10 + actorCC;
    const totalItemPrice = goldPart * 100 + silverPart * 10 + copperPart;

    if (totalMoney < totalItemPrice) {
      ChatMessage.create({
        content: game.i18n.format("DB-IB.notEnoughMoney", {
          actor: userActor.name,
          item: item.name,
        }),
        speaker: ChatMessage.getSpeaker({ actor: userActor }),
      });
      return;
    }

    // Deduct money correctly
    let newGold = actorGC - goldPart;
    let newSilver = actorSC - silverPart;
    let newCopper = actorCC - copperPart;

    while (newGold < 0) {
      actorSC -= 10;
      if (actorSC >= 0) newGold++;
      else {
        actorCC -= 100;
        newGold++;
      }
    }
    while (newSilver < 0) {
      actorGC -= 1;
      if (actorGC >= 0) {
        newSilver += 10;
        actorSC += 10;
      } else {
        actorCC -= 10;
        newSilver += 1;
        actorSC += 1;
      }
    }
    while (newCopper < 0) {
      actorSC -= 1;
      if (actorSC >= 0) {
        newCopper += 10;
        actorCC += 10;
      } else {
        actorGC -= 1;
        newCopper += 100;
        actorCC += 100;
      }
    }

    await userActor.update({
      "system.currency.gc": actorGC - goldPart,
      "system.currency.sc": actorSC - silverPart,
      "system.currency.cc": actorCC - copperPart,
    });

    await userActor.createEmbeddedDocuments("Item", [item]);

    if (item.system.quantity > 1) {
      await item.update({ "system.quantity": item.system.quantity - 1 });
    } else {
      await merchantActor.deleteEmbeddedDocuments("Item", [itemID]);
    }

    ChatMessage.create({
      content: game.i18n.format("DB-IB.spendMoney", {
        actor: userActor.name,
        item: item.name,
        itemPrice: priceLabel,
      }),
      speaker: ChatMessage.getSpeaker({ actor: userActor }),
    });
  }
  async sellFromChat(event) {
    const ChatMessageRoll = game.messages.get(
      event.target.getAttribute("data-message-id"),
    );
    const allitemsToSell = ChatMessageRoll.system.items;
    const actorsItems = Object.keys(allitemsToSell);
    const rollResults =
      ChatMessageRoll.system.barterSkillRoll.postRollData.success;
    const isDragon =
      ChatMessageRoll.system.barterSkillRoll.postRollData.isDragon;
    const merchantActor = game.actors.get(
      ChatMessageRoll.system.merchantActor._id,
    );
    let allcost = 0;
    let cost = 0;
    actorsItems.forEach(async (actorID) => {
      const userActor = game.actors.get(actorID);
      const itemsToSell = allitemsToSell[actorID];
      let names = "";
      itemsToSell.forEach(async (item) => {
        if (names !== "") {
          names += ", ";
        }
        const priceMatch = item.price.match(/^([\d.]+)\s*([a-zA-Z]+)$/);
        const itemCost = priceMatch[1];
        const coinType = priceMatch[2];
        if (rollResults === false) {
          cost = itemCost;
        } else if (rollResults === true && isDragon === false) {
          cost = Math.round(itemCost * 1.2 * 100) / 100;
        } else if (rollResults === true && isDragon === true) {
          cost = Math.round(itemCost * 1.5 * 100) / 100;
        }
        const coinsType = [
          game.i18n.translations.DoD.currency.gold.toLowerCase(),
          "gold",
          game.i18n.translations.DoD.currency.silver.toLowerCase(),
          "silver",
          game.i18n.translations.DoD.currency.copper.toLowerCase(),
          "copper",
        ];
        const currencyType = coinsType.indexOf(coinType);
        switch (currencyType) {
          case 0:
          case 1:
            cost *= 100;
            break;
          case 2:
          case 3:
            cost *= 10;
            break;
          case 4:
          case 5:
            cost = cost;
            break;
        }
        names += item.name;
        allcost += cost;
        const itemToDeleteMerchant = merchantActor.items.get(item.id);
        const itemToDeletActor = userActor.items.get(
          itemToDeleteMerchant.flags["dragonbane-item-browser"].originalID,
        );
        await merchantActor.deleteEmbeddedDocuments("Item", [item.id]);

        if (itemToDeletActor.system.quantity > 1) {
          await itemToDeletActor.update({
            "system.quantity": itemToDeletActor.system.quantity - 1,
          });
        } else {
          await userActor.deleteEmbeddedDocuments("Item", [
            itemToDeleteMerchant.flags["dragonbane-item-browser"].originalID,
          ]);
        }
      });

      const goldPart = Math.floor(allcost / 100);
      const silverPart = Math.floor((allcost % 100) / 10);
      const copperPart = Math.round(allcost % 10);
      let priceLabel = "";
      if (goldPart !== 0) {
        priceLabel =
          String(goldPart) +
          " " +
          game.i18n.translations.DoD.currency.gold.toLowerCase();
      }
      if (goldPart !== 0 && silverPart !== 0 && copperPart === 0) {
        priceLabel += game.i18n.localize("DB-IB.Chat.and");
        priceLabel +=
          " " +
          String(silverPart) +
          " " +
          game.i18n.translations.DoD.currency.silver.toLowerCase();
      }
      if (goldPart !== 0 && silverPart !== 0 && copperPart !== 0) {
        priceLabel += game.i18n.localize("DB-IB.Chat.and");
        priceLabel +=
          " " +
          String(silverPart) +
          " " +
          game.i18n.translations.DoD.currency.silver.toLowerCase();
      }
      if (goldPart === 0 && silverPart !== 0) {
        priceLabel +=
          String(silverPart) +
          " " +
          game.i18n.translations.DoD.currency.silver.toLowerCase();
      }
      if (
        (goldPart !== 0 && silverPart !== 0 && copperPart !== 0) ||
        (goldPart === 0 && silverPart !== 0 && copperPart !== 0) ||
        (goldPart !== 0 && silverPart === 0 && copperPart !== 0)
      ) {
        priceLabel += game.i18n.localize("DB-IB.Chat.and");
        priceLabel +=
          " " +
          String(copperPart) +
          " " +
          game.i18n.translations.DoD.currency.copper.toLowerCase();
      }
      if (goldPart === 0 && silverPart === 0 && copperPart !== 0) {
        priceLabel +=
          String(copperPart) +
          " " +
          game.i18n.translations.DoD.currency.copper.toLowerCase();
      }

      let actorGC = userActor.system.currency.gc;
      let actorSC = userActor.system.currency.sc;
      let actorCC = userActor.system.currency.cc;
      await userActor.update({
        "system.currency.gc": actorGC + goldPart,
        "system.currency.sc": actorSC + silverPart,
        "system.currency.cc": actorCC + copperPart,
      });
      ChatMessage.create({
        content: game.i18n.format("DB-IB.spendMoney", {
          actor: userActor.name,
          item: names,
          itemPrice: priceLabel,
        }),
        speaker: ChatMessage.getSpeaker({ actor: userActor }),
      });
    });
  }
}
