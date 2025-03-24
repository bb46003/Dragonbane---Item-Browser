
import DragonbaneDataModel from "/systems/dragonbane/modules/data/DragonbaneDataModel.js"
import DoD_Utility from "/systems/dragonbane/modules/utility.js";


export class merchantData extends DragonbaneDataModel  {
    static defineSchema() {
        const {fields} = foundry.data;

     
        return this.mergeSchema(super.defineSchema(), {
            selling_rate:   new fields.NumberField({
                required: true,
                initial: 0.5,
                min: 0.01,
               
            }),
            buing_rate:  new fields.NumberField({
                required: true,
                initial: 1,
                min: 0,
            }),
            supply:  new fields.StringField({ required: true, initial: "any" }),
            encumbrance:  new fields.SchemaField({
                value: new fields.NumberField({required: true, integer: true, initial: 0, min: 0 })
            }),
        })      
    }
   

}


export class merchant extends ActorSheet{
    static get defaultOptions() {
        return foundry.utils.mergeObject(super.defaultOptions, {
          classes: ["merchant"],
          template: "modules/dragonbane-item-browser/templates/merchant.hbs",
          width: 800,
          height: "auto",
          tabs: [
            {
              navSelector: ".sheet-tabs",
              contentSelector: ".sheet-body",
              initial: "glowna",
            },
          ],
          
        });
    }
      async getData() {
        const source = super.getData();
        const actorData = this.actor.toObject(false);
        const updateActoprData = await deleteSkill(actorData)
        const context = {
          actor: updateActoprData,
          editable: this.isEditable,
          items: updateActoprData.items,
          limited: this.actor.limited,
          options: this.options,
          owner: this.actor.isOwner,
          source: source.system,
          system: actorData.system,
          type: this.actor.type,
          useKgs: this.actor.useKgs,
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
            const items = actorData.items;
            const filteredItem = items.filter(item => item.type !== "skill")
            actorData.items=filteredItem;
            return actorData
            
            
          }
      
        return context
    }
    activateListeners(html) {
        super.activateListeners(html);
        html.on("input", "#slider-selling", (ev) => this.updateSliderOutput(ev));
        html.on("change", "#slider-selling", (ev) => {
            const newValue = parseFloat(ev.target.value);
            this.actor.update({ "system.selling_rate": newValue }); 
            const slider = ev.target;
            slider.blur();
            
        });
        html.on("input", "#slider-buing", (ev) => this.updateSliderOutput(ev));
        html.on("change", "#slider-buing", async (ev) => {
            const newValue = parseFloat(ev.target.value); 
            await this.actor.update({ "system.buing_rate": newValue }); 
            const slider = ev.target;
            slider.blur();
            
        });
        html.on("change", "#percentage", (ev) => this.textInput(ev))
        html.on("change",".supply-selection", (ev) => this.changeSupply(ev))
        html.on("click",".fa.fa-trash", (ev) => this.removeFromSelling(ev))
        html.on("click","button.sell-button", (ev) => this.sellWithOutBarter(ev))
       
     
        html.on("click", ".fas.fa-coins",(ev) => this.buyItem(ev));
     
       
    }
    updateSliderOutput(ev) {
        const slider = ev.target;
        const output = slider.nextElementSibling; 
        if (slider && output) {
            const sliderValue = Number(slider.value);
            output.textContent = `${(sliderValue * 100).toFixed(0)}%`;
            const thumbOffset = ((sliderValue - Number(slider.min)) / ((Number(slider.max) - Number(slider.min))) * Number(slider.offsetWidth)) + 1.2*Number(slider.offsetWidth);
            output.style.left = `${thumbOffset}px`;
            output.style.position = "absolute"; 
            output.style.top = "75%"
        }   
    }
    async textInput(ev){
        const input = ev.target.value;
        const nearestSlider = Array.from(ev.currentTarget.parentElement.childNodes).find(
            (node) => node.tagName === "INPUT" && node.type === "range"
          );
        const systemVaralble = nearestSlider.getAttribute("name");
        const max = Number(nearestSlider.getAttribute("max"))
        const actor = this.actor;
        const regex = /^[1-9]\d*%?$/;
        const regex2 =  /^[1-9]\d*%$/;
     
       
        const isMatch = regex.test(input);
        if(isMatch){
            let value = 0;  
            if (input.includes("%")) {
                const newinput = input.replace("%", "");
                value = Number(newinput)/100;
              }
            else{
                value = Number(input)/100;
            }                     
            const isMatch2 = regex2.test(input);
            if(!isMatch2){
                ev.target.value = input + "%";
            }
            if(value > max){
                nearestSlider.setAttribute("max",value)  
            }
            else if(value <= 2 && max > 2){
                nearestSlider.setAttribute("max",2)  
            }
            await actor.update({[systemVaralble]:value})

        }
        else{
            const warning = game.i18n.localize("DB-IB.warrning.incoretInput")
            DoD_Utility.WARNING(warning);
            ev.target.value = String(Number(actor.system[`${systemVaralble}`])*100)+"%"
        }

     

    }
    async changeSupply(ev){
        const value = ev.currentTarget.value
        await this.actor.update({["system.supply"]:value})
    }
    async _onDrop(event) {
        event.preventDefault();
        const data = event.dataTransfer;
        if (data) {
            const droppedItem = JSON.parse(data.getData("text/plain"));  
            const itemData = await fromUuid(droppedItem.uuid);
            const hasCost = itemData?.system?.cost !== undefined && itemData.system.cost !== "";
            if(hasCost){
                const supplyTypes = ["common", "uncommon", "rare", "any"];
                const index = supplyTypes.indexOf(this.actor.system.supply);
                const itemSuply = supplyTypes.indexOf(itemData.system.supply)
                const itemPriceNoSpace = itemData.system.cost.replace(/\s+/g, "");
              
                const regex = /^(\d+[Dd]\d+)(x?)(\d*)([a-zA-Z\u0100-\u017F]+)$/;
                
                
                if (regex.test(itemPriceNoSpace)) {
                    const [dice,  multiplyer, currency] = itemPriceNoSpace.match(regex);
                    const formula = multiplyer ? `${dice}*${multiplyer}` : dice;
                    
                    const costRoll =await  new Roll(formula).evaluate();
                    const content = game.i18n.format("DB-IB.rollForPrice", {
                        formula: formula,
                        item: itemData.name,
                        currency: currency
                    });
    
                     await costRoll.toMessage({
                        user: game.user.id,
                        flavor: content,
                    });
    
                    const sellingPrice = `${costRoll.total} ${currency}`;
                    await itemData.update({["system.cost"]:sellingPrice})
                }
                if(droppedItem.uuid.includes("Actor")){
                    const actorID = droppedItem.uuid.split(".")[1]
                    await itemData.update({ flags: { "actor": actorID }})
                    if(itemSuply <= index){
                        if(itemData.system.quantity > 1){
                            const html = await renderTemplate("modules/dragonbane-item-browser/templates/dialog/define-quantity.hbs", {item:itemData.name, quantity:Number(itemData.system.quantity)})
                            new Dialog({
                                title: game.i18n.localize("DB-IB.dialog.denfieQuantity"),
                                content: html,
                                buttons:{
                                    sell:{
                                        label: game.i18n.localize("DB-IB.dialog.sell"),
                                        callback: async () =>{
                                            const selectedQuantity = document.querySelector(".quantity-selector").value;
                                            const newName= itemData.name + `(${selectedQuantity})`;
                                            const oldCost = itemData.system.cost.match(/(\d+)\s*(\w+)/); ;
                                            const newPrice = String(Number(oldCost[1]) * Number(selectedQuantity))+" "+oldCost[2];
                                          
                                            await this.actor.createEmbeddedDocuments("Item", [itemData])
                                            const merchantItem = this.actor.items.find(item => item.flags.actor === actorID && item.name === itemData.name);
                                            await merchantItem.update({["system.cost"]:newPrice,["name"]:newName})

                                        }
                                    }
                                }

                            }).render(true)
                        }
                        else{
                            await this.actor.createEmbeddedDocuments("Item", [itemData])
                        }
                    }
                    else{
                        DoD_Utility.WARNING(game.i18n.localize("DB-IB.merchant.notAcceptSuply"))
                    }                  
                }
                else{
                    if(game.user.isGM){
                        const existingItem = this.actor.items.filter(item => {
                            if (item.type === "item" && item.name === itemData.name) {
                                const itemTemplate = { ...itemData.system };
                                delete itemTemplate.quantity;
                                return foundry.utils.objectsEqual(foundry.utils.filterObject(item.system, itemTemplate), itemTemplate);
                            }
                            return false;
                        });
                        if (existingItem.length !== 0) {
                            const itemQuantity = itemData.system.quantity + existingItem[0].system.quantity;
                            return await existingItem[0].update({["system.quantity"]: itemQuantity});
                        }
                        else{
                            await this.actor.createEmbeddedDocuments("Item", [itemData])
                        }
                    }
                    else{
                        DoD_Utility.WARNING(game.i18n.localize("DB-IB.merchant.nonGMaddItemsToSell"))
                    }
                }               
            }
        }
    
    }
    async removeFromSelling(ev){
        const item =  ev.target.closest(".buying-item");
        if(item !== null){
        const userID = game.user.id;
        const actorID = game.actors.filter(actor => {return actor.ownership[userID]===3 && actor.type === "character"})     
        const sellingHeader = ev.target.closest(".actor-group").querySelector(".header-row");
        const ownerOfSellingItem = sellingHeader.getAttribute("id");
        let isOwner = false;
        actorID.forEach(actor => {
            if(actor._id === ownerOfSellingItem){
                isOwner = true;
            }
            
        });
        if(isOwner){
            const ID = item.getAttribute("id");
            await this.actor.deleteEmbeddedDocuments("Item",[ID])
        }
        else{
            DoD_Utility.WARNING(game.i18n.localize("DB-IB.warrning.youAreNotOwnerOfDeletedItem"))
        }
    }
    else{
        const itemID = ev.target.id;
        await this.actor.deleteEmbeddedDocuments("Item",[itemID])
    }

    }
    async sellWithOutBarter(ev){
        const actorGroups = document.querySelectorAll(".actor-group");

        const result = {};
        const coinsType = [game.i18n.translations.DoD.currency.gold.toLowerCase(), "gold", game.i18n.translations.DoD.currency.silver.toLowerCase(), "silver", game.i18n.translations.DoD.currency.copper.toLowerCase(), "copper"];
        actorGroups.forEach(group => {
           
            const header = group.querySelector(".header-row");
            const headerID = header.id;
            const items = group.querySelectorAll(".buying-item");
            const itemsData = Array.from(items).map(item => {
                const itemID = item.id;
                const name = item.querySelector("label:not(.price-label)").innerText;
                const price = item.querySelector(".price-label").innerText.trim();
                return { id: itemID, price: price, name: name};
            });
            result[headerID] = itemsData;
        });
      
        Object.keys(result).forEach(async headerID => {
            let totalPrice = 0;
            let allItemName = "";
            const sellingActor = game.actors.get(headerID);
            result[headerID].forEach(async item => {
                const priceMatch = item.price.match(/^([\d.]+)\s*([a-zA-Z]+)$/);
                if (priceMatch) {
                    const price = Math.round(Number(priceMatch[1]) * 10) / 10;
                    const coninType = priceMatch[2];
                    let currencyType = coinsType.indexOf(coninType)
                    switch(currencyType){
                        case 0:
                        case 1:
                            totalPrice += price * 100
                            break;
                        case 2:
                        case 3:
                            totalPrice += price * 10
                            break;
                        case 3:
                        case 4:
                            totalPrice += price
                            break;            
                    } 
                    if(allItemName !== ""){
                        allItemName += ", "
                    }
                    allItemName += item.name;
                    const sellingItem = item.name;
                    this.actor.deleteEmbeddedDocuments("Item",[item.id])
                    const removerdItem = await sellingActor.items.find(item => item.name === sellingItem)
                    sellingActor.deleteEmbeddedDocuments("Item",[removerdItem._id])

                }
            });
            const sellingPrice = totalPrice;
            const goldPart = Math.floor(sellingPrice / 100); 
            const silverPart = Math.floor((sellingPrice % 100) / 10); 
            const copperPart = Math.round(sellingPrice % 10); 
            let actorGC= sellingActor.system.currency.gc;
            let actorSC = sellingActor.system.currency.sc;
            let actorCC = sellingActor.system.currency.cc;
            await sellingActor.update({
                ["system.currency.gc"]: actorGC + goldPart,
                ["system.currency.sc"]: actorSC + silverPart,
                ["system.currency.cc"]: actorCC + copperPart,
    
            })
            const content = await renderTemplate("modules/dragonbane-item-browser/templates/chat/sell-with-merchant.hbs",{copperPart:copperPart, silverPart:silverPart, goldPart:goldPart, actor:sellingActor.name, items:allItemName})
            ChatMessage.create({
                content: content
            });
        });
    }
    async buyItem(ev) {
        const rollForBarter = game.settings.get("dragonbane-item-browser", "barter-roll-when-buys");
        const user = game.user;
        const itemID = ev.target.id;
        const item = this.actor.items.get(itemID);
        const itemDiv = ev.target.closest(".selling-item");
        const priceLabel = itemDiv.querySelector(".price-label").textContent.trim();
        const coinsType = [
            game.i18n.translations.DoD.currency.gold.toLowerCase(), "gold",
            game.i18n.translations.DoD.currency.silver.toLowerCase(), "silver",
            game.i18n.translations.DoD.currency.copper.toLowerCase(), "copper"
        ];
        const priceMatch = priceLabel.match(/^([\d.]+)\s*([a-zA-Z]+)$/);
        const coinType = priceMatch[2];
        let sellingPrice ;
        let currencyType;
        let userActor;
    
        if (user.isGM) {
            const characters = game.actors.filter(actor => actor.type === "character")
            
            const content = await renderTemplate("modules/dragonbane-item-browser/templates/dialog/chose-actor.hbs", { actors:characters });
            userActor = await new Promise((resolve) => {               
    
                new Dialog({
                    title: game.i18n.localize("DB-IB.dialog.selectActor"),
                    content: content,
                    buttons: {
                        select: {
                            label: game.i18n.localize("DB-IB.dialog.sell"),
                            callback: async (html) => {
                                const selectedActorId = html.find("select").val();
                                const selectedActor = game.actors.get(selectedActorId);
                                resolve(selectedActor);
                            }
                        }
                    },
                    close: () => resolve(null)
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
    
        if (rollForBarter) {
            // Implement barter roll logic if needed
            return;
        }
    
        else{
       
        sellingPrice = Number(priceMatch[1]);
        currencyType = coinsType.indexOf(coinType);
        }
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
                content: game.i18n.format("DB-IB.notEnoughMoney", { actor: userActor.name, item: item.name }),
                speaker: ChatMessage.getSpeaker({ actor: userActor })
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
            await this.actor.deleteEmbeddedDocuments("Item", [itemID]);
        }
    
        ChatMessage.create({
            content: game.i18n.format("DB-IB.spendMoney", {
                actor: userActor.name,
                item: item.name,
                itemPrice: priceLabel
            }),
            speaker: ChatMessage.getSpeaker({ actor: userActor })
        });
    }
    
    async rollForBarter(ev){
        
    }
}



import {DoDActor} from "/systems/dragonbane/modules/actor.js"
export class DB_BI_Actor extends DoDActor {


     /** @override */
    async  _preCreate(data, options, user) {

        await super._preCreate(data, options, user);
        if (this.type === "dragonbane-item-browser.merchant"){
            if (this.items.size !== 0){
                data.items = [];
                await this.updateSource(data);
            }
        }
        // If the created actor has items (only applicable to duplicated actors) bypass the new actor creation logic
        if (!data.items?.length)
        {
            if (this.type !== "monster" && this.type !== "dragonbane-item-browser.merchant") {
                let baseSkills = await DoD_Utility.getBaseSkills();
                if (baseSkills) {
                    data.items = baseSkills;
                    this.updateSource(data);
                }
            }
            switch (this.type) {
                case "character":
                    await this.updateSource({
                        "system.age": data.system ? data.system.age : "adult",
                        "prototypeToken.actorLink": true,
                        "prototypeToken.disposition": 1, // Friendly
                        "prototypeToken.bar1.attribute": "hitPoints",
                        "prototypeToken.bar2.attribute": "willPoints",
                        "prototypeToken.displayBars": 30, // Hovered by Anyone
                        "prototypeToken.sight.enabled": true, // Vision enabled
                    });
                    break;
                case "npc":
                    await this.updateSource({
                        "prototypeToken.disposition": 0, // Neutral
                        "prototypeToken.bar1.attribute": "hitPoints",
                        "prototypeToken.displayBars": 20, // Hovered by Owner
                    });
                    break;
                case "monster":
                    await this.updateSource({
                        "system.size": data.system ? data.system.size : "normal",
                        "prototypeToken.disposition": -1, // Hostile
                        "prototypeToken.bar1.attribute": "hitPoints",
                        "prototypeToken.displayBars": 20, // Hovered by Owner
                    });
                    break;
                case "dragonbane-item-browser.merchant":
                        break;
            }
        }
    }

    prepareBaseData() {
        if(this.type !== "dragonbane-item-browser.merchant"){
        super.prepareBaseData();

        // reset attributes
        for (const attribute in this.system.attributes) {
            this.system.attributes[attribute].value = this.system.attributes[attribute].base;
        }
        // reset ferocity
        if (this.system.ferocity) {
            this.system.ferocity.value = this.system.ferocity.base;
        }

        // prepare skills
        this._prepareSkills();
        this._prepareBaseChances();
        this._prepareKin();
        this._prepareProfession();
    }
    
       
    
    }

}