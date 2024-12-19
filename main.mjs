
import {itemsSearch} from  "./item-searching.mjs"
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

  registerHandlebarsHelpers()
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
    <i id="custom-search-button" for="item-browser"
        class="fa-solid fa-magnifying-glass" 
        data-type="ability" 
        title="Items Browser"></i>
        </button<
      `;  
      const buttonSpellHTML = `  <button class="item-browser" id="${actorID}">
    <i id="custom-search-button" for="item-browser"
        class="fa-solid fa-magnifying-glass" 
        data-type="spell" 
        title="Items Browser"></i>  </button>
      `;  
  const heroic = game.i18n.translations.DoD.ui["character-sheet"].heroicAbilities;
  const magicTrick = game.i18n.translations.DoD.ui["character-sheet"].trick;
  const spell =  game.i18n.translations.DoD.ui["character-sheet"].spell;
  const creatItemButton =document.querySelectorAll(".item-create");
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
    if (!existingButton) {
        const buttonHTML = `
          <button class="item-browser" id="${actorID}">
            <i id="custom-search-button" for="item-browser"
               class="fa-solid fa-magnifying-glass eq" 
               data-type="${dataType}" 
               title="Items Browser"></i>
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
})
Hooks.on("renderChatLog", DBIBChat.addChatListeners)


async function openItemsBrowser(event,actorID){
  event.preventDefault();
  const element = event.currentTarget;
  const type = element.dataset.type
  const filterData ={chosenType:type};
  if (actorID === undefined){
    console.log(event)
  }
  const browser = new itemsSearch(filterData,actorID)
  console.log(actorID)
  browser.openBrowser(filterData,actorID)
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
                <i class="fas fa-coins" id="${item.id}"></i>`       
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

