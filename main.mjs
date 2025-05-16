
import {itemsSearch, sellingItem} from  "./item-searching.mjs"
import * as DBIBChat from "./item-searching.mjs"
import { merchant, merchantData, DB_BI_Actor, sellingItemMerchat } from "./merchant-character.mjs";
import { SocketHandler } from "./socketHandler.mjs";


Hooks.once("init", function () {

  game.settings.register("dragonbane-item-browser", "barter-roll-when-buys", {
      name: game.i18n.localize("DB-IB.settings.rollForBarter"),
      hint: game.i18n.localize("DB-IB.settings.hintRollForBarter"),
      scope: "world",
      type: Boolean,
      default: false,
      config: true,
      onChange: foundry.utils.debounce(() => {
          window.location.reload();
      }, 100),
  });

  game.settings.register("dragonbane-item-browser", "custom-barter-skill", {
      name: game.i18n.localize("DB-IB.settings.nonCoreSkill"),
      hint: game.i18n.localize("DB-IB.settings.hintSkillBarter"),
      scope: "world",
      type: String,
      default: "",
      config: true, 
  });

  game.settings.register("dragonbane-item-browser", "sell-items", {
    name: game.i18n.localize("DB-IB.settings.selling"),
    hint: game.i18n.localize("DB-IB.settings.hintSelling"),
    scope: "world",
    type: Boolean,
    default: false,
    config: true, 
});

game.settings.register("dragonbane-item-browser", "stash-items", {
  name: game.i18n.localize("DB-IB.settings.stash"),
  hint: game.i18n.localize("DB-IB.settings.hintStash"),
  scope: "world",
  type: Boolean,
  default: false,
  config: true, 
});
game.settings.register("dragonbane-item-browser", "skip-folders-for-browser", {
  name: game.i18n.localize("DB-IB.settings.skippedFoldersForBrowser"),
  hint: game.i18n.localize("DB-IB.settings.hintSkippedFoldersForBrowser"),
  scope: "world",
  type: Boolean,
  default: false,
  config: true,
  onChange: foundry.utils.debounce(() => {
      window.location.reload();
  }, 100),
});
game.settings.register("dragonbane-item-browser", "selectedFolders", {
  name: "Selected Folders",
  scope: "world",
  type: Array,
  config: false,
});

  registerHandlebarsHelpers()
 const myPackage = game.modules.get("dragonbane-item-browser") // or just game.system if you're a system
  myPackage.socketHandler = new SocketHandler()

  const ActorsElemet = game.release.generation < 13 ? Actors         : foundry.documents.collections.Actors;
  ActorsElemet.registerSheet("merchant", merchant ,{
    types: ["dragonbane-item-browser.merchant"],
    makeDefault: true
  })
  Object.assign(CONFIG.Actor.dataModels, {
        "dragonbane-item-browser.merchant": merchantData
  });

  const DoDItemClass = CONFIG.Item.documentClass;
  if (!DoDItemClass) {
    console.error("DoDItem class not found.");
    return;
  }


  const originalTotalWeightGetter = Object.getOwnPropertyDescriptor(DoDItemClass.prototype, 'totalWeight').get;
  Object.defineProperty(DoDItemClass.prototype, 'totalWeight', {
    get: function() {
      if (this.system.isStash) {
        return 0;
      }
      else{
        return originalTotalWeightGetter.call(this);
      }
    }
  })

  CONFIG.Actor.documentClass = DB_BI_Actor;


  
  const { fields } = foundry.data;
  const itemTypes = ["item", "helmet", "armor", "weapon"];


  itemTypes.forEach((itemType) => {
    const originalDefineSchema = CONFIG.Item.dataModels[itemType]?.defineSchema;
  
    if (!originalDefineSchema) {
      console.warn(`No defineSchema method found for item type: ${itemType}`);
      return;
    }
  
   
    CONFIG.Item.dataModels[itemType].defineSchema = function () {
      const originalSchema = originalDefineSchema.call(this);
      return this.mergeSchema(originalSchema, {
        isStash: new fields.BooleanField({ required: false, initial: false }),
      });
    };
  
   
  })
  preloadHandlebarsTemplates();
});



Hooks.on('hoverToken', async (token, ev) => {
  const actor = token.actor;  

    if(actor.type === "dragonbane-item-browser.merchant" && ev && game.users.activeGM !== null && !actor.sheet.rendered && !game.user.isGM){
      const title = game.i18n.localize("DB-IB.dialog.openMerchantSheet")
      const html = await renderTemplate("modules/dragonbane-item-browser/templates/dialog/open-merchant-sheet.hbs")
      const dialogId = "open-merchant-sheet-dialog";
    if (document.getElementById(dialogId)) return;
    const dialog = new Dialog({
      title: title,
      content: html,
      buttons:{
        renderMerchangt:{
          label: game.i18n.localize("CONTROLS.CommonOpenSheet"),
          callback: async () => {
            game.modules.get("dragonbane-item-browser").socketHandler.emit( {
              type: "ownMerchant",
              userId: game.user.id,
              actorId: actor.id
            }); 
          }
          },
        cancel:{label: game.i18n.localize("Cancel")}
      },
      
    },
    {appId:dialogId}) 
    
    dialog.render(true)
    setTimeout(() => {
  if (dialog.element) dialog.element[0].id = dialogId;
}, 100);
 
     
}
});
Hooks.on("renderSettingsConfig", (app, html, data) => {
  const barterRollEnabled = game.settings.get("dragonbane-item-browser", "barter-roll-when-buys");
  const $html = $(html);
  const barterSkillRow = $html .find('[name="dragonbane-item-browser.custom-barter-skill"]').closest(".form-group");
  const toggleCustomBarterSkill = (isEnabled) => {
      if (isEnabled) {
          barterSkillRow.show();
      } else {
          barterSkillRow.hide();
      }
  };

 
  
  const skipFoldersEnabled = game.settings.get("dragonbane-item-browser", "skip-folders-for-browser");
  //const settingContainer = $html.find('[data-setting-id="dragonbane-item-browser.skip-folders-for-browser"] .form-fields');
  
  const label = $html.find('label[for="settings-config-dragonbane-item-browser.skip-folders-for-browser"]');
  let settingContainer
  if(game.release.generation < 13){
    settingContainer = html.find('[data-setting-id="dragonbane-item-browser.skip-folders-for-browser"] .form-fields');
  }
  else{
    settingContainer = label.closest('.form-group').find('.form-fields');
  }
  const toggleFolderList = (isEnabled) => {
      if (isEnabled) {
          settingContainer.find(".folder-checkboxes").show();
      } else {
          settingContainer.find(".folder-checkboxes").hide();
      }
  };
  
  const itemFolders = game.folders.filter(f => f.type === "Item");
  if (itemFolders.length !== 0) {
      let checkboxList = `<div class="folder-checkboxes"  ${skipFoldersEnabled ? '' : 'style="display:none;"'}>`;
  
     
      itemFolders.forEach(folder => {
          let folders = game.settings.get("dragonbane-item-browser", "selectedFolders");
          let checked = folders?.includes(folder.id) ? "checked" : "";
       
          checkboxList += `
              <div class="folder-element">
                  <label>
                      <input type="checkbox" id="selectedFolder" value="${folder.id}" ${checked}> ${folder.name}
                  </label>
              </div>
          `;
      });
  
      checkboxList += `</div>`;
  
      settingContainer.append(checkboxList);
  

      settingContainer.find('input[id="selectedFolder"]').on("change", async function () {
        let selectedFolders = await game.settings.get("dragonbane-item-browser", "selectedFolders") || []
    
        if (this.checked) {
          if (!selectedFolders?.includes(this.value)) {
              selectedFolders.push(this.value); 
          }
      } else {
          selectedFolders = selectedFolders.filter(id => id !== this.value); 
      }
    
        await game.settings.set("dragonbane-item-browser", "selectedFolders", selectedFolders); 
       
    });
    
  }
  toggleCustomBarterSkill(barterRollEnabled);

  const barterRollCheckbox = $html.find('[name="dragonbane-item-browser.barter-roll-when-buys"]');
  barterRollCheckbox.on("change", (event) => {
      toggleCustomBarterSkill(event.target.checked);
  });


  const skipFoldersCheckbox = $html.find('[name="dragonbane-item-browser.skip-folders-for-browser"]');
  skipFoldersCheckbox.on("change", (event) => {
      toggleFolderList(event.target.checked);
  });
  
});
Hooks.on("closemerchant",async (token)=>{
 const actor = token.actor;  
if(!game.user.isGM){
   game.modules.get("dragonbane-item-browser").socketHandler.emit( {
      type: "ownMerchantRemove",
      userId: game.user.id,
      actorId: actor.id
    }); 
    }
})

Hooks.on("renderDoDCharacterSheet", async (html) => {
  const title = game.i18n.localize("DB-IB.openItemBrowser")
  const actorID = html.object._id;
  const buttonAbilitiesHTML = `
    <button class="item-browser" id="${actorID}" data-type="ability" title="${title}">
      <a class="fa-solid fa-magnifying-glass"></a>
    </button>`;  
  const buttonSpellHTML = `  
    <button class="item-browser" id="${actorID}" data-type="spell" title="${title}">
      <a class="fa-solid fa-magnifying-glass" ></a>
    </button>`;  
  const heroic = game.i18n.translations.DoD.ui["character-sheet"].heroicAbilities;
  const magicTrick = game.i18n.translations.DoD.ui["character-sheet"].trick;
  const spell =  game.i18n.translations.DoD.ui["character-sheet"].spell;
  const creatItemButton = document.querySelectorAll(".item-create");
  
  const actor = await game.actors.get(actorID);
  const actorSheet = actor.sheet._element[0];
  const headers =actorSheet.querySelectorAll("th.text-header");

  let targetHeader = null;
  headers.forEach(header => {
    if (header.textContent.trim() === heroic) {
      targetHeader = header;
      
     
      targetHeader.insertAdjacentHTML("afterbegin", buttonAbilitiesHTML);  
    }
  });

  targetHeader = null;
  headers.forEach(header => {
    if (header.textContent.trim() === magicTrick) {
      targetHeader = header;
  
      targetHeader.insertAdjacentHTML("afterbegin", buttonSpellHTML);
    }
  });
   
  targetHeader = null;
  headers.forEach(header => {
    if (header.textContent.trim() === spell) {
      targetHeader = header;
      const closestNumberHeader = header.previousElementSibling; 
      closestNumberHeader.insertAdjacentHTML("afterbegin", buttonSpellHTML);   
    }
  });

  creatItemButton.forEach(button => {
    const dataType = button.getAttribute("data-type"); 
    if(dataType !== "effect"){
    const existingButton = button.nextElementSibling?.classList.contains("item-browser");

    if (!existingButton) {
        const buttonHTML = `
          <button class="item-browser" id="${actorID}" title="${title}"  data-type="${dataType}">
            <a class="fa-solid fa-magnifying-glass"></a>
          </button>
        `;
        button.insertAdjacentHTML("afterend", buttonHTML);
    }
  }
  });
  const buttonsBrowser = html._element[0].querySelectorAll("button.item-browser");

  buttonsBrowser.forEach(button => {
    if (!button.dataset.eventAttached) {
        button.addEventListener("click", (event) => {
            openItemsBrowser(event, actorID);
        });
        button.dataset.eventAttached = "true";
    }
  });

  const sellsSetting = game.settings.get("dragonbane-item-browser", "sell-items")
  const stashSetting = game.settings.get("dragonbane-item-browser", "stash-items")
  const items = document.querySelectorAll(".sheet-table-data.item.draggable-item");
if(stashSetting){
  const title = game.i18n.localize("DB-IB.stash")
  const worn = document.querySelectorAll(".fa-shirt")
  const closestThElements = Array.from(worn).map((element) => element.closest('th'));
  const stashIcon = `<th class="checkbox-header-stash">
                                    <label title="${title}">
                                        <a class="fa-solid fa-box"></a>
                                    </label>
                                </th>`;
 
  closestThElements.forEach(icon =>{
    icon.insertAdjacentHTML("beforebegin", stashIcon)
  })
}

  if(sellsSetting || stashSetting){  
    items.forEach(item =>{
      const dataType = item.getAttribute("data-item-id"); 
      const binIcon = item.querySelector(".item-delete");
      const iconData = item.querySelector(".icon-data");
      if(stashSetting){
      const wornCheckbox = item.querySelector('input[data-field="system.worn"]')?.closest('td');
      const templateStash = `
        <td class="checkbox-data">
          <input class="inline-edit" data-field="system.isStash" type="checkbox" id="{{id}}" data-tooltip="{{hint}}" {{#if system.isStash}}checked{{/if}}>
        </td>
      `;
      const compiledTemplate = Handlebars.compile(templateStash);
      const actor1 = game.actors.get(actorID);
      const itemData = actor1.items.filter(item => item._id === dataType)[0];
      const data = {
        id: dataType,
        system:{
          isStash: itemData.system.isStash,
        },
        hint: game.i18n.localize("DB-IB.stashItem")
      };
      const stashCheckBox = compiledTemplate(data);
      $(stashCheckBox).insertBefore(wornCheckbox);
    }
    if(sellsSetting){
      const title = game.i18n.localize("DB-IB.sellItem");
      const actor = game.actors.get(actorID);
      const singleItem = actor.items.filter(element => element.id === dataType)[0];
      const singleItemHaveCost = /\d/.test(singleItem.system.cost);
      if(singleItemHaveCost){  
        const addSellingIcon = `
          <button class="item-browser-sold" actor-data ="${actorID}" id="${dataType}" title="${title}">
            <i  for="item-browser-sold" class="fa-solid fa-piggy-bank" id="${dataType}" ></i>
          </button>`; 
      const hasSellingButton = iconData.querySelector(".item-browser-sold") === null;
      if (hasSellingButton) {
        binIcon.insertAdjacentHTML("beforebegin", addSellingIcon);
      }
    }
    }
  })
  if(sellsSetting){
    const buttonsSell = document.querySelectorAll("button.item-browser-sold");
    buttonsSell.forEach(button => {
    if (!button.dataset.eventAttached) {
        button.addEventListener("click", (event) => {
          selliItem(event, actorID);
        });
        button.dataset.eventAttached = "true";
    }
    });
  }
  if(stashSetting){
    const stash = document.querySelectorAll('input[data-field="system.isStash"]')
    stash.forEach(checkbox => {
    if (!checkbox.dataset.eventAttached) {
      checkbox.addEventListener("change", (event) => {
        stashItem(event, actorID);
      });
      checkbox.dataset.eventAttached = "true";
  }
    });
  }
}
 
})
Hooks.on("renderChatLog", DBIBChat.addChatListeners)



Hooks.on("renderChatLog", (app, html, data) => {
  const sellingInstance = new sellingItem({ itemID: null, actorID: null });
    sellingInstance.addChatListeners(app, html, data);
  const sellingMerchantInstance = new sellingItemMerchat({ itemID: null, actorID: null });
  sellingMerchantInstance.addChatListeners(app, html, data);
});

Hooks.on("createActor", async function (actor) { 
  if(actor.type === "dragonbane-item-browser.merchant"){
    actor.ownership.default = 3;
  }
})


async function openItemsBrowser(event,actorID){
  event.preventDefault();
  const element = event.currentTarget;
  const type = element.dataset.type;
  const filterData ={chosenType:type};
  const browser = new itemsSearch(filterData,actorID);
  browser.openBrowser(filterData,actorID);
}

async function  selliItem(event,actorID) {
  event.preventDefault()
  const itemID = event.target.id;
  const sell = new sellingItem(itemID,actorID);
  sell.selling(itemID,actorID) 
}

async function stashItem(event,actorID) {
  event.preventDefault()
  const itemID = event.target.id;
  const isStash = event.target.checked;
  const actor = game.actors.get(actorID);
  const item = actor.items.filter(item => item._id === itemID)[0];
  if(item.system.worn){
    await item.update({"system.worn": false})
  }
  
  await item.update({"system.isStash": isStash})
  

}

function registerHandlebarsHelpers() {
  Handlebars.registerHelper({
      eq: (v1, v2) => v1 === v2,
      ne: (v1, v2) => v1 !== v2,
      lt: (v1, v2) => v1 < v2,
      gt: (v1, v2) => v1 > v2,
      lte: (v1, v2) => v1 <= v2,
      gte: (v1, v2) => v1 >= v2,
      and() {
        return Array.prototype.every.call(arguments, Boolean);
      },
      or() {
        return Array.prototype.slice.call(arguments, 0, -1).some(Boolean);
      },
    });
    Handlebars.registerHelper("havePrice", (item)=>{
      let html = ";"
      if(item.system?.cost !== "" && item.system?.cost !== undefined){
        html = `<i class="cost">${item.system.cost}</i>
                <i class="fas fa-plus" id="${item.id}" data-tooltip="${game.i18n.localize("DB-IB.addItemToCharacter")}"></i>
                <i class="fas fa-coins" id="${item.id}" data-tooltip="${game.i18n.localize("DB-IB.buyItem")}"></i>`       
      }
      else{
        html = `<i class="fas fa-plus" id="${item.id}"></i>`
      }
      return new Handlebars.SafeString(html);
    })
    Handlebars.registerHelper("removeUUID", (description) =>{
      const containUUID = description.includes("@");
      let descriptionWithoutHTML = "";
      if (containUUID){
        const descriptionWithRemovedUUID = description.replace(/@.*?\{(.*?)\}/, '$1');
        descriptionWithoutHTML = descriptionWithRemovedUUID.replace(/<[^>]*>/g, '');
        
      }
      else{
        descriptionWithoutHTML = description.replace(/<[^>]*>/g, '');
        
      }
      
      return descriptionWithoutHTML
  
    })
    Handlebars.registerHelper("isGM", () => {
      const isGM = game.user.isGM;
      if(isGM){
        const localize = game.i18n.localize("DB-IB.merchant.setting")
        const html = `<a class="settings" data-tab="settings">${localize}</a>`
        return html
      }
    })
    Handlebars.registerHelper("sellingRate",(selling_rate)=>{
      const sellingRatePercentage = String(Math.round(selling_rate * 100))+"%";
      const html = `  <input   id="percentage"   type="text"  value="${sellingRatePercentage}">`
      return html
    })
    Handlebars.registerHelper("groupByActor", function (items) {
      const grouped = {};
      
      items.forEach(item => {
          if (item.flags["dragonbane-item-browser"]?.actor) { 
              const actorFlag = item.flags["dragonbane-item-browser"].actor;
              if (!grouped[actorFlag]) {
                  grouped[actorFlag] = [];
              }
              grouped[actorFlag].push(item);
          }
      });
  
      let result = "";
      const sells = game.i18n.localize("DB-IB.merchant.sells");
      const itemName = game.i18n.localize("DB-IB.itemName");
      const itemPrice = game.i18n.localize("DB-IB.itemPrice");
  
      for (const [actorId, items] of Object.entries(grouped)) {
          const actor = game.actors.get(actorId);
          const actorName = actor.name;
  
          result += `
              <div class="actor-group">
                  <div class="header-row" id="${actorId}">
                      <h3>${actorName} ${sells}</h3>
                  </div>
                  <div class="buying-item-header">
                      <label>${itemName}</label>
                      <label>${itemPrice}</label>
                  </div>
          `;
  
          for (const item of items) {
              const itemCost = item.system.cost;
              const buyingRate = this.actor.system?.buing_rate || 1;
             
  
             
              let [costValue, currency2] = itemCost.split(" ");
              const finalCost = Number(costValue) * buyingRate;
              let roundedCost;

              if (currency2 === "copper" || currency2 === game.i18n.translations.DoD.currency.copper.toLowerCase()) {
                roundedCost = Math.round(finalCost);
              } 
              else if (currency2 === "silver" || currency2 === game.i18n.translations.DoD.currency.silver.toLowerCase()) {
                roundedCost = finalCost.toFixed(1);
              } 
              else if (currency2 === "gold" || currency2 === game.i18n.translations.DoD.currency.gold.toLowerCase()) {
                roundedCost = finalCost.toFixed(2);
              }
              if(roundedCost< 1){
                const coinsTypeLocal = [game.i18n.translations.DoD.currency.gold.toLowerCase(), game.i18n.translations.DoD.currency.silver.toLowerCase(), game.i18n.translations.DoD.currency.copper.toLowerCase()];
                const coinTypeEn = ["gold", "silver", "copper"]
                roundedCost = roundedCost*10;
                let coin2 = coinTypeEn.indexOf(currency2)
                let coin3 = 0
                if(coin2 === -1){
                  coin3 = coinsTypeLocal.indexOf(currency2)
                  currency2 =  coinsTypeLocal[coin3+1]
                }
                else {
                  currency2 = coinTypeEn[coin2+1]
                }
                
              }
              const finalSellingPrice = `${roundedCost} ${currency2}`;
  
              result += `
                  <div class="buying-item" id="${item._id}">
                      <label>${item.name}</label>
                      <label class="price-label">${finalSellingPrice}</label>
                      <label><i class="fa fa-trash"></i></label>
                  </div>
              `;
          }
  
          result += `</div>`; 
      }
      const newHtml = new Handlebars.SafeString(result);

      return newHtml
    });  
    Handlebars.registerHelper('range', function(end) {
    let result = "";
    for (let i = 0; i <= end; i++) {
        result += `<option value="${i}">${i}</option>`
    }
    return new Handlebars.SafeString(result); 
    });
    Handlebars.registerHelper('itemToBuy', function(items){
      const itemName = game.i18n.localize("DB-IB.itemName");
      const itemPrice = game.i18n.localize("DB-IB.itemPrice");
  
      let result = ` 
      <div class="item-group">
        <div class="selling-item-header">
          <label>${itemName}</label>
          <label>${itemPrice}</label>
        </div>`
  const sellingRate = this.actor.system?.selling_rate || 1;
      items.forEach(item => {
          if (!item.flags?.actor && item.flags?.actor !== undefined) { 
            const [costValue, currency2] = item.system.cost.split(" ");
            const finalCost = Number(costValue) * sellingRate;
            let roundedCost;

            if (currency2 === "copper" || currency2 === game.i18n.translations.DoD.currency.copper.toLowerCase()) {
              roundedCost = Math.round(finalCost);
            } 
            else if (currency2 === "silver" || currency2 === game.i18n.translations.DoD.currency.silver.toLowerCase()) {
              roundedCost = finalCost.toFixed(1);
            } 
            else if (currency2 === "gold" || currency2 === game.i18n.translations.DoD.currency.gold.toLowerCase()) {
              roundedCost = finalCost.toFixed(2);
            }
            const isGM = game.user.isGM;
            const finalPrice = `${roundedCost} ${currency2}`;
            const description = item.system.description;
            const containUUID = description.includes("@");
            let descriptionWithoutHTML = "";
            if (containUUID){
              const descriptionWithRemovedUUID = description.replace(/@.*?\{(.*?)\}/, '$1');
              descriptionWithoutHTML = descriptionWithRemovedUUID.replace(/<[^>]*>/g, '');       
            }
           else{
             descriptionWithoutHTML = description.replace(/<[^>]*>/g, '');
            }
            if(item.system.quantity > 1 ){
            result += `
             <div class="selling-item" id="${item._id}">
                <label data-tooltip='${descriptionWithoutHTML}'>${item.name}(${item.system.quantity})</label>
                <label class="price-label">${finalPrice}</label>
                <div class="merchant-icon">
                  <i class="fas fa-coins" id="${item._id}" data-tooltip="${game.i18n.localize("DB-IB.buyItem")}"></i>
                  ${isGM ? `<label><i class="fa fa-trash" id="${item._id}"></i></label>` : ""}
                </div>
             </div>`;
            }
         else{
          result += `
          <div class="selling-item" id="${item._id}">
            <label data-tooltip='${descriptionWithoutHTML}'>${item.name}</label>
            <label class="price-label">${finalPrice}</label>
            <div class="merchant-icon">
              <i class="fas fa-coins" id="${item._id}" data-tooltip="${game.i18n.localize("DB-IB.buyItem")}"></i>
              ${isGM ? `<label><i class="fa fa-trash" id="${item._id}"></i></label>` : ""}
            </div>
          </div>`;
         }
      }
          
      });
      result +=`</div>`  
      const newHtml = new Handlebars.SafeString(result);

      return newHtml
      

    });
  
}

async function preloadHandlebarsTemplates() {
  if(game.release.generation < 13){
  return loadTemplates([
    "modules/dragonbane-item-browser/templates/tab/settings.hbs",
    "modules/dragonbane-item-browser/templates/tab/to-buy.hbs",
    "modules/dragonbane-item-browser/templates/tab/to-sell.hbs"
  ])
  }
  else{
    foundry.applications.handlebars.loadTemplates([ 
      "modules/dragonbane-item-browser/templates/tab/settings.hbs",
      "modules/dragonbane-item-browser/templates/tab/to-buy.hbs",
      "modules/dragonbane-item-browser/templates/tab/to-sell.hbs"])
  }
}
