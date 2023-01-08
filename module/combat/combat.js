export default class GDSACombat extends Combat {
    
    _sortCombatants(a, b) {

        const iniA = Number.isNumeric(a.initiative) ? a.initiative : -9999;
        const iniB = Number.isNumeric(b.initiative) ? b.initiative : -9999;

        let iniDifference = iniB - iniA;
        if(iniDifference != 0)
            return iniDifference;

        const aBaseData = a.actor?.sheet?.getData();
        if(!aBaseData) return a.tokenId - b.tokenId;
        const bBaseData = b.actor?.sheet?.getData();
        if(!bBaseData) return a.tokenId - b.tokenId;
        const InIBaseA = (aBaseData.actor.type == "PlayerCharakter") ? aBaseData.system.INIBasis.value : aBaseData.system.INI.split(" + ")[1];
        const InIBaseB = (bBaseData.actor.type == "PlayerCharakter") ? bBaseData.system.INIBasis.value : bBaseData.system.INI.split(" + ")[1];
        
        let baseDifference = InIBaseB - InIBaseA;
        if(baseDifference != 0)
            return baseDifference;
        
        const IntA = a.actor.system.IN.value;
        const IntB = b.actor.system.IN.value;

        let inDifference = IntB - IntA;
        if(inDifference != 0)
            return inDifference;
        
        return a.tokenId - b.tokenId;
    }

    async rollInitiative(ids, {formula=null, updateTurn=true, messageOptions={}}={}) {

        const template = "systems/GDSA/templates/chat/ini-check.hbs";
        ids = typeof ids === "string" ? [ids] : ids;
        const currentId = this.combatant?.id;
        const updates = [];
        const messages = [];
        const rollModels = [];

        for ( let [i, id] of ids.entries() ) {
    
            const combatant = this.combatants.get(id);
            if ( !combatant?.isOwner ) continue;

            const roll = combatant.getInitiativeRoll(formula);
            await roll.evaluate({async: true});
            updates.push({_id: id, initiative: roll.total});   
            let templateContext = {roll: roll};

            combatant.setFlag("GDSA", "attacksMax", game.actors.get(combatant.actorId).system.ATCount);
            combatant.setFlag("GDSA", "attacks", game.actors.get(combatant.actorId).system.ATCount);     
            combatant.setFlag("GDSA", "parriesMax", game.actors.get(combatant.actorId).system.PACount);     
            combatant.setFlag("GDSA", "parries", game.actors.get(combatant.actorId).system.PACount); 

            let chatData2 = {
                user: game.user.id,
                speaker: ChatMessage.getSpeaker(combatant.actor),
                content: await renderTemplate(template, templateContext)
            };
          
            if (!game.modules.get("dice-so-nice")?.active) chatData2.sound = CONFIG.sounds.dice;
            
            for (let i = 0; i < roll.dice[0].results.length; i++) {
                
                let model = {
                    result: roll.dice[0].results[i].result,
                    resultLabel: roll.dice[0].results[i].result,
                    type: "d6",
                    vectors:[],
                    options:{}};
                rollModels.push(model);
            }

            messages.push(chatData2);
        }

        let result = new Promise(resolve => {
            if(!game.modules.get("dice-so-nice")?.active) { ChatMessage.implementation.create(messages); resolve(true)} 
            else game.dice3d.show({ throws:[{dice: rollModels}]}).then(displayed => { ChatMessage.implementation.create(messages); resolve(true)});
        });

        await result;

        if ( !updates.length ) return this;
        await this.updateEmbeddedDocuments("Combatant", updates);

        if ( updateTurn && currentId ) await this.update({turn: this.turns.findIndex(t => t.id === currentId)});

        return this;
    }

    async startCombat() {

        super.startCombat();

        const combatants = this.combatants.contents;

        for (let i = 0; i < combatants.length; i++) {

            this.combatants.get(combatants[i]._id).setFlag("GDSA", "attacksMax", game.actors.get(combatants[i].actorId).system.ATCount);
            this.combatants.get(combatants[i]._id).setFlag("GDSA", "attacks", game.actors.get(combatants[i].actorId).system.ATCount);     
            this.combatants.get(combatants[i]._id).setFlag("GDSA", "parriesMax", game.actors.get(combatants[i].actorId).system.PACount);     
            this.combatants.get(combatants[i]._id).setFlag("GDSA", "parries", game.actors.get(combatants[i].actorId).system.PACount);           
        }
    }

    async nextRound() {
 
        super.nextRound();
        const combatants = this.combatants.contents;

        for (let i = 0; i < combatants.length; i++) {

            this.combatants.get(combatants[i]._id).setFlag("GDSA", 'attacks', game.actors.get(combatants[i].actorId).system.ATCount);
            this.combatants.get(combatants[i]._id).setFlag("GDSA", 'parries', game.actors.get(combatants[i].actorId).system.PACount);           
        }
    }
}