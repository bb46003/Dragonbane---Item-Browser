
import {itemsSearch} from  "./item-searching.mjs"
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

Hooks.once("init", function () {
        registerHandlebarsHelpers();
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
  const headers = document.querySelectorAll("th.text-header");
  let targetHeader = null;
  headers.forEach(header => {
    if (header.textContent.trim() === heroic) {
      targetHeader = header;
    }
  });
  targetHeader.insertAdjacentHTML("afterbegin", buttonAbilitiesHTML);   


  targetHeader = null;
  headers.forEach(header => {
    if (header.textContent.trim() === magicTrick) {
      targetHeader = header;
    }
  });
  targetHeader.insertAdjacentHTML("afterbegin", buttonSpellHTML);   
  
  targetHeader = null;
  headers.forEach(header => {
    if (header.textContent.trim() === spell) {
      targetHeader = header;
    }
  });
  targetHeader.insertAdjacentHTML("afterbegin", buttonSpellHTML);   
  
  creatItemButton.forEach(button => {
    const dataType = button.getAttribute("data-type"); 
    const buttonHTML = `  <button class="item-browser" id="${actorID}">
    <i id="custom-search-button" for="item-browser"
        class="fa-solid fa-magnifying-glass eq" 
        data-type="${dataType}" 
        title="Items Browser"></i>  </button>
      `;  
      button.insertAdjacentHTML("afterend", buttonHTML); 
    
  });
  const buttonsBrowser = document.querySelectorAll(".fa-magnifying-glass");

buttonsBrowser.forEach(button => {
    button.addEventListener("click", (event) => {
        openItemsBrowser(event,actorID);
    });
});
})
  

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