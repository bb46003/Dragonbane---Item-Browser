export class itemsSearch extends Dialog {
    constructor({ title, content, buttons, filterData, actorID}) {
       
        super({
            title,     
            content,   
            buttons,
            actorID,
            filterData
        });
        this.filterData = filterData; 
        this.actorID = actorID;
    }

    activateListeners(html) {
        super.activateListeners(html);
        html.on("change", ".filter", this.changeitemType.bind(this)); 
        html.on("click", ".fas.fa-coins", this.buyItem.bind(this)); 
        html.on("click", ".fas.fa-plus", this.addItem.bind(this)); 
        html.on("click",".item-name-browser", this.openItem.bind(this))
    }

    async changeitemType(event) {
        const filter = event.target.classList[1];
        if (filter === "type"){
            this.filterData.chosenType = event.target.value;  
        }
        else{
        this.filterData.filters[filter]=event.target.value;
        }
        this.filterData.chosenItems =await this.itemFiltration( this.filterData,this.filterData.chosenType);
        const template = await renderTemplate(
            "modules/dragonbane-item-browser/items-search.hbs",
            {data: this.filterData }
        );       
        this.data.content = template;
        this.render(true,{width:700,height:500})
    }

    async openBrowser(filterData,actorID) {
    const title = "Items Browser";
    filterData = { ...filterData, ...(await this._prepareWorldsItems(filterData.chosenType,actorID)) };
    const template = await renderTemplate(
        "modules/dragonbane-item-browser/items-search.hbs",
        {data:filterData }
    );

   const browser = new itemsSearch({
        title:title,
        content: template,
        filterData: filterData,  
        buttons: {},
    })
    browser.render(true,{width:700, height:500});
    browser.element.find('.dialog-button').addClass('hidden-button')
    }

    async _prepareWorldsItems(chosenType, actorID){
    let types = [
        "ability",
        "armor",
        "helmet",
        "item",
        "spell",
        "weapon"]
        const supplyTypes = ["common", "uncommon", "rare"];

    const filteredItems = game.items.filter(item => {
        const isTypeValid = types.includes(item.type);
        const isSupplyTypeValid = item.system.supply ? supplyTypes.includes(item.system.supply) : true;
        return isTypeValid && isSupplyTypeValid;
    });    
    const weaponsSkillsArray = game.items.filter(item => item.type === "skill" && item.system.skillType === "weapon");
    const weaponsSkills =weaponsSkillsArray.reduce((obj, item) => {
        obj[item.name] = item.name;
        return obj;
    }, {});;
  
    const magicSkills = game.items.filter(item => item.type === "spell")
    const removeDuplicatedMagicSkills =  [...new Set(magicSkills.map(item => item.system.school))];
    const magicSkillsmNames = removeDuplicatedMagicSkills.reduce((obj, name) => {
        obj[name] = name;
        return obj;
    }, {});;
    const spellDurationTypes = game.i18n.translations.DoD.spellDurationTypes;
    const spellRangeTypes = game.i18n.translations.DoD.spellRangeTypes;
    const spellCastingTimeTypes = game.i18n.translations.DoD.castingTimeTypes;
    let weaponFeatureTypes = game.i18n.translations.DoD.weaponFeatureTypes;
    Object.keys(weaponFeatureTypes).forEach(key => {
        if (key.includes("Tooltip")) {
            delete weaponFeatureTypes[key];
        }
    });
    const any = game.i18n.localize("DB-IB.Any")
    const supply = {
        common: game.i18n.translations.DoD.supplyTypes.common,        
        uncommon: game.i18n.translations.DoD.supplyTypes.uncommon,        
        rare: game.i18n.translations.DoD.supplyTypes.rare,
        any: any

    }
    
    weaponsSkills.any = any;
    magicSkillsmNames.any = any;
    spellRangeTypes.any = any;
    weaponFeatureTypes.any = any;
    spellCastingTimeTypes.any = any;
    const gripTypes = game.i18n.translations.DoD.gripTypes;
    gripTypes.any = any;
    spellDurationTypes.any = any;
    const filters = {
        weaponSkill:Object.keys(weaponsSkills)[0],
        grip:Object.keys(spellDurationTypes)[0],
        weaponFeature:Object.keys(weaponFeatureTypes)[0],
        school:Object.keys(magicSkillsmNames)[0],
        duration:Object.keys(spellDurationTypes)[0],
        castingTime:Object.keys(spellCastingTimeTypes)[0],
        range:Object.keys(spellRangeTypes)[0],
        rank:0,
        supply: Object.keys(supply)[0]

    }
    types =  {
        ability:game.i18n.translations.TYPES.Item.ability,
        armor:game.i18n.translations.TYPES.Item.armor,
        helmet: game.i18n.translations.TYPES.Item.helmet,
        item:game.i18n.translations.TYPES.Item.item,
        spell:game.i18n.translations.TYPES.Item.spell,
        weapon:game.i18n.translations.TYPES.Item.weapon}
        const data = {
            types: types,
            items: filteredItems,
            weaponSkills: weaponsSkills,
            magicSchool: magicSkillsmNames,
            duration: spellDurationTypes,
            castingTime : spellCastingTimeTypes,
            range: spellRangeTypes,
            weaponFeature : weaponFeatureTypes,
            grip: gripTypes,
            supply: supply,
            filters:filters,
            actor:actorID


        }
        const chosenItems = await this.itemFiltration(data,chosenType);
        data.chosenItems = chosenItems
        return data

    }

    async itemFiltration(data,chosenType){
    let chosenItems = {};
    switch(chosenType){
        case "ability":
            chosenItems = data.items.filter(item =>item.type === "ability")
            break;
        case "armor":
            chosenItems = data.items.filter(item =>item.type === "armor")
            break;
        case "helmet":
            chosenItems = data.items.filter(item =>item.type === "helmet")
            break;
        case "item":
            chosenItems = data.items.filter(item =>item.type === "item" &&
                (data.filters.supply === "any" || item.system.supply === data.filters.supply))
            break;
        case "weapon":
            chosenItems = data.items.filter(item =>
                item.type === "weapon" && 
                (data.filters.weaponSkill === "any" ||item.system.skill.name === data.filters.weaponSkill) &&
                (data.filters.grip === "any" ||item.system.grip.value === data.filters.grip) &&
                (data.filters.weaponFeature === "any" ||item.system.features.includes(data.filters.weaponFeature) )&&
                (data.filters.supply === "any" || item.system.supply === data.filters.supply)               
            )
            break;
        case "spell":
            chosenItems = data.items.filter(item =>
                item.type === "spell" && 
                (data.filters.school === "any" || item.system.school === data.filters.school)&&
                (data.filters.duration === "any" ||item.system.duration === data.filters.duration) &&
                (data.filters.castingTime === "any" ||item.system.castingTime === data.filters.castingTime) &&
                (data.filters.range === "any" ||item.system.rangeType === data.filters.range) &&
                (data.filters.rank === "any" || item.system.rank === Number(data.filters.rank))      
            )
            break;
        }
    return chosenItems

    }

    async buyItem(event){
        const actor = game.actors.get(this.data.filterData.actor);
        const item = game.items.get(event.target.id);
        const itemData = item.toObject(); 
        
        const buyIitem = await this.spendMoney(item,actor);
        if(buyIitem){
            await actor.createEmbeddedDocuments("Item", [itemData])
            await actor.update()
        }

    }
    async addItem(event){
        const actor = game.actors.get(this.data.filterData.actor);
        const item = game.items.get(event.target.id);
        const itemData = item.toObject(); 
        await actor.createEmbeddedDocuments("Item", [itemData])
        await actor.update()
        ChatMessage.create({
            content: game.i18n.format("DB-IB.addItem",{actor:actor.name, type:item.type,item:item.name}),
            speaker: ChatMessage.getSpeaker({ actor })
        });

    }

    async spendMoney(item,actor){
        let actorGC= actor.system.currency.gc;
        let actorSC = actor.system.currency.sc;
        let actorCC = actor.system.currency.cc;
        let itemPrice = item.system.cost; 
        const itemPriceNoSpace = itemPrice.replace(/\s+/g, "");
        const regex = /^(\d+D\d+)x(\d+)([a-zA-Z]+)$/;
        const isMatch = regex.test(itemPriceNoSpace);
        let enoughMoney = true;
        if(isMatch){
            const dice = itemPriceNoSpace.match(regex)[1];
            const multiplyer = itemPriceNoSpace.match(regex)[2];
            const currency = itemPriceNoSpace.match(regex)[3]
            const formula = `${dice}*${multiplyer}`
            const costRoll =await new Roll(formula).evaluate()
            const content = game.i18n.format("DB-IB.rollForPrice",{formula:formula,item:item.name,currency:currency})
            costRoll.toMessage({
                user: game.user.id,
                speaker: ChatMessage.getSpeaker({ actor }),
                flavor: content,
            });
            itemPrice = String(costRoll.total)+" "+currency;          
        }
        const cost = Number(itemPrice.split(" ")[0]);
        let isCopper;
        let testPattern = ""
        const localCopper = [game.i18n.translations.DoD.currency.copper.toLowerCase(), "copper"];
        for (const string of localCopper) {
            testPattern = new RegExp(`^\\d+\\s+${string}$`);
            isCopper = testPattern.test(itemPrice);
            if (isCopper) {
                break; 
            }
        }
        let isSilver;
        
        const localSilver = [game.i18n.translations.DoD.currency.silver.toLowerCase(), "silver"];
        for (const string of localSilver) {
            testPattern = new RegExp(`^\\d+\\s+${string}$`);
            isSilver = testPattern.test(itemPrice);
            if (isSilver) {
                break; 
            }
        }
        let isGold;
        const localGold = [game.i18n.translations.DoD.currency.gold.toLowerCase(), "gold"];
        for (const string of localGold) {
            testPattern = new RegExp(`^\\d+\\s+${string}$`);
            isGold = testPattern.test(itemPrice);
            if (isGold) {
                break; 
            }
        }

        if (isCopper){
            
            while (cost > actorCC) {
                if (actorCC < cost && actorSC > 0){
                    actorSC = actorSC - 1;
                    actorCC = actorCC + 10;
                }
                if (actorCC < cost && actorSC === 0 && actorGC >0){
                    actorSC = actorSC + 9;
                    actorGC = actorGC - 1;
                    actorCC = actorCC + 10
                }
                if (actorGC === 0 && actorSC === 0 && actorCC < cost) {
                   ChatMessage.create({
                        content: game.i18n.format("DB-IB.notEnoughMoney",{actor:actor.name,item:item.name}),
                        speaker: ChatMessage.getSpeaker({ actor })
                    });
                    enoughMoney = false              
                    break;
                }
            }
            if(enoughMoney){
            actorCC = actorCC -cost;
            }
        }
        else if (isSilver){
           
            while (cost > actorSC){
                if (actorSC < cost  && actorCC >= 10){
                    actorCC = actorCC - 10;
                    actorSC = actorSC + 1
                }
                else if (actorSC < cost && actorCC < 10 && actorGC > 0){
                    actorGC = actorGC - 1;
                    actorSC = actorSC + 10                   
                }
                if (actorGC === 0 && actorCC < 10 && actorSC < cost) {
                    ChatMessage.create({
                        content: game.i18n.format("DB-IB.notEnoughMoney",{actor:actor.name,item:item.name}),
                        speaker: ChatMessage.getSpeaker({ actor })
                    }); 
                    enoughMoney = false             
                    break;
                }   
            }
            if(enoughMoney){
                actorSC = actorSC -cost;
            }
        }
        else if (isGold){
          
            while (cost > actorGC){
                console.log(cost > actorGC)
                if (actorCC >=10){
                    actorCC = actorCC - 10;
                    actorSC = actorSC + 1;
                }
                if(actorSC >=10){
                    actorSC = actorSC - 10;
                    actorGC = actorGC + 1;
                }
                if (actorCC < 10 && actorSC < 10 && actorGC < cost) {
                    ChatMessage.create({
                        content: game.i18n.format("DB-IB.notEnoughMoney",{actor:actor.name,item:item.name}),
                        speaker: ChatMessage.getSpeaker({ actor })
                     });     
                     enoughMoney = false         
                     break;
                 }
            }
            if(enoughMoney){
                actorGC = actorGC - cost
            }
          
        }
        
        if ((actorGC !== actor.system.currency.gc || 
            actorSC !== actor.system.currency.sc ||
            actorCC !== actor.system.currency.cc) && enoughMoney
        ){
            await actor.update({
                ["system.currency.gc"]: actorGC,
                ["system.currency.sc"]: actorSC,
                ["system.currency.cc"]: actorCC,

            })
        ChatMessage.create({
            content:game.i18n.format("DB-IB.spendMoney",{actor:actor.name,item:item.name, itemPrice,itemPrice}),
            speaker: ChatMessage.getSpeaker({ actor })
        });
      
        }
        else if(enoughMoney) { 
            ChatMessage.create({
                content: game.i18n.format("DB-IB.manualMonyRemoval",{itemPrice:itemPrice, item:item.name}),
                speaker: ChatMessage.getSpeaker({ actor })
            });
  

        }
        return enoughMoney

    }
    async openItem(event){
        const item = game.items.get(event.target.id);
        item.sheet.render(true)

    }
}

