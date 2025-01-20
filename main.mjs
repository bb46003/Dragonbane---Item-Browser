
import {itemsSearch, sellingItem} from  "./item-searching.mjs"
import * as DBIBChat from "./item-searching.mjs"

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
    default: "",
    config: true, 
});

game.settings.register("dragonbane-item-browser", "stash-items", {
  name: game.i18n.localize("DB-IB.settings.stash"),
  hint: game.i18n.localize("DB-IB.settings.hintStash"),
  scope: "world",
  type: Boolean,
  default: "",
  config: true, 
});

  registerHandlebarsHelpers()



  // Check if the class DoDItem exists
  const DoDItemClass = CONFIG.Item.documentClass;
  if (!DoDItemClass) {
    console.error("DoDItem class not found.");
    return;
  }

  // Get the original getter
  const originalTotalWeightGetter = Object.getOwnPropertyDescriptor(DoDItemClass.prototype, 'totalWeight').get;

  // Override the getter
  Object.defineProperty(DoDItemClass.prototype, 'totalWeight', {
    get: function() {
      if (this.system.isStash) {
        return 0; // Return 0 if the item is in a stash
      }
      else{
        return originalTotalWeightGetter.call(this);
      }
    }
  });

  console.log("Modified totalWeight getter in DoDItem.");
  const { fields } = foundry.data;
  const itemTypes = ["item", "helmet", "armor", "weapon"];

  // Iterate over each item type and modify its schema
  itemTypes.forEach((itemType) => {
    const originalDefineSchema = CONFIG.Item.dataModels[itemType]?.defineSchema;
  
    if (!originalDefineSchema) {
      console.warn(`No defineSchema method found for item type: ${itemType}`);
      return;
    }
  
    // Override the defineSchema method for the current item type
    CONFIG.Item.dataModels[itemType].defineSchema = function () {
      // Call the original defineSchema to get the base schema
      const originalSchema = originalDefineSchema.call(this);
  
      // Merge the base schema with the new property
      return this.mergeSchema(originalSchema, {
        isStash: new fields.BooleanField({ required: false, initial: false }),
      });
    };
  
    console.log(`Successfully added 'isStash' to ${itemType} schema.`);
  })
});

Hooks.on("renderSettingsConfig", (app, html, data) => {
  const barterRollEnabled = game.settings.get("dragonbane-item-browser", "barter-roll-when-buys");
  const barterSkillRow = html.find('[name="dragonbane-item-browser.custom-barter-skill"]').closest(".form-group");
  const toggleCustomBarterSkill = (isEnabled) => {
      if (isEnabled) {
          barterSkillRow.show();
      } else {
          barterSkillRow.hide();
      }
  };
  toggleCustomBarterSkill(barterRollEnabled); 
  const barterRollCheckbox = html.find('[name="dragonbane-item-browser.barter-roll-when-buys"]');
  barterRollCheckbox.on("change", (event) => {
      const isChecked = event.target.checked;
      toggleCustomBarterSkill(isChecked);
  });
});

Hooks.on("renderDoDCharacterSheet", (html) => {
  const actorID = html.object._id;
  const buttonAbilitiesHTML = `
    <button class="item-browser" id="${actorID}">
      <i id="custom-search-button" for="item-browser" class="fa-solid fa-magnifying-glass" data-type="ability" title="Items Browser"></i>
    </button>`;  
  const buttonSpellHTML = `  
    <button class="item-browser" id="${actorID}">
      <i id="custom-search-button" for="item-browser" class="fa-solid fa-magnifying-glass" data-type="spell" title="Items Browser"></i>
    </button>`;  
  const heroic = game.i18n.translations.DoD.ui["character-sheet"].heroicAbilities;
  const magicTrick = game.i18n.translations.DoD.ui["character-sheet"].trick;
  const spell =  game.i18n.translations.DoD.ui["character-sheet"].spell;
  const creatItemButton = document.querySelectorAll(".item-create");
  
  const actorSheet = game.actors.get(actorID).sheet._element[0];
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
    
      targetHeader.insertAdjacentHTML("afterbegin", buttonSpellHTML);   
    }
  });

  creatItemButton.forEach(button => {
    const dataType = button.getAttribute("data-type"); 
    const existingButton = button.nextElementSibling?.classList.contains("item-browser");
    const title = game.i18n.localize("DB-IB.openItemBrowser")
    if (!existingButton) {
        const buttonHTML = `
          <button class="item-browser" id="${actorID}">
            <i id="custom-search-button" for="item-browser"
               class="fa-solid fa-magnifying-glass eq" 
               data-type="${dataType}" 
               title="${title}"></i>
          </button>
        `;
        button.insertAdjacentHTML("afterend", buttonHTML);
    }
    
  });
  const buttonsBrowser = document.querySelectorAll(".fa-magnifying-glass");

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
          <button class="item-browser-sold" id="${actorID}">
            <i id="${dataType}" for="item-browser-sold" class="fa-solid fa-piggy-bank" title="${title}"></i>
          </button>`; 
      const hasSellingButton = iconData.querySelector(".item-browser-sold") === null;
      if (hasSellingButton) {
        binIcon.insertAdjacentHTML("beforebegin", addSellingIcon);
      }
    }
    }
  })
  if(sellsSetting){
    const buttonsSell = document.querySelectorAll(".fa-solid.fa-piggy-bank");
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
});


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
}

