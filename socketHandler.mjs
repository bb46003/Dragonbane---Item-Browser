export class SocketHandler{
    constructor() {
        this.identifier = "module.dragonbane-item-browser" 
        this.registerSocketEvents()
    }
    registerSocketEvents() {

        game.socket.on(this.identifier, async (data) => {
              
            switch(data.type){
                case "ownMerchant":
                    if(game.user.isGM){
                        const actor = game.actors.get(data.actorId);
                        await actor.update({
                            ownership: {
                            ...actor.ownership,
                            [data.userId]: 3
                            }
                        });
                        this.emit({
                            type: "renderMerchant",
                            actorId: data.actorId,
                            userId: data.userId
                        })
                    }
                break;
                case "renderMerchant":
                    if(game.user.id === data.userId){
                        const actor = game.actors.get(data.actorId);
                        if (!actor.sheet.rendered) {
                            actor.sheet.render(true);
                        }
                    }
                break;
                case "ownMerchantRemove":
                     if(game.user.isGM){
                        const actor = game.actors.get(data.actorId);
                        await actor.update({
                            ownership: {
                            ...actor.ownership,
                            [data.userId]: 0
                            }
                        });
                break;
                 
                }
            }
        })
    }
        emit(data) {
            return game.socket.emit(this.identifier, data)
        }
   
}
    