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
                    }
                break;

                case "setTemporaryOwner":
                    if(game.user.isGM){
                        const actor = game.actors.get(data.actorId);
                        actor.setFlag( "dragonbane-item-browser","temporary", true)
                    }
                break;
                 
                
            }
        })
    }
        emit(data) {
            return game.socket.emit(this.identifier, data)
        }
   
}
    