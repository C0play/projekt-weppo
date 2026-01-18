import * as GameTypes from "../shared/types";

export const d = new Date()
function createDecks(numberOfDecks: number = 4): GameTypes.Card[] {
    const deck: GameTypes.Card[] = [];
    const SUITS = ['hearts','diamonds','spades','clubs'];
    const RANKS = ['2','3','4','5','6','7','8','9','10','jack','queen','king','ace'];
    
    for(let i=0; i<numberOfDecks;i++)
    {
        for(const suit of SUITS) {
            for(const rank of RANKS)
            {
                let points = 0;
                if (rank === 'queen' || rank === 'king' || rank === 'jack') {
                    points = 10;
                }
                else if (rank === 'ace') {
                    points = 11;
                }
                else {
                    points = parseInt(rank);
                }
                deck.push({
                    point: points,
                    rank: rank,
                    suit: suit
                })
            }
        }
    }
    return deck;

}

function shuffle(deck: GameTypes.Card[]): GameTypes.Card[] {
    deck = deck.sort(func)
    function func(_a: any, _b: any): number {
        return 0.5 - Math.random();
    }

    return deck;
}
export class Turn implements GameTypes.Turn {
    public player_idx : number;
    public hand_idx : number;
    public timestamp : number;
    public validMoves : string[]

    constructor()
    {
        this.player_idx = 0;
        this.hand_idx = 0;
        this.timestamp = Date.now();
        this.validMoves=[];
    }
}
export class Player implements GameTypes.Player {
    public nick: string
    public hands: GameTypes.Hand[]
    public balance: number
    public player_idx: number
    public active : boolean
    constructor(nick: string) {
        this.nick = nick
        this.hands = [{cards : [],bet : 0,number_of_full_aces:0,points:0}]
        this.balance = 1000
        this.player_idx = 0
        this.active = true
    }
}

export class Game {

    private deck : GameTypes.Card[]
    public players : Player[]
    public dealer : GameTypes.Dealer

    public uuid: string
    public number_of_players : number
    public max_players = 5;
    public turn = new Turn()
    public game_phase : GameTypes.GamePhase

    constructor()
    {
        this.deck = shuffle(createDecks(4));
        this.players = [];
        this.dealer = { cards: [], points: 0, number_of_full_aces : 0 }
        this.number_of_players = 0
        this.uuid = globalThis.crypto.randomUUID()
        this.game_phase = GameTypes.GamePhase.BETTING
    }

    public add_player(player : Player): void
    {
        player.player_idx = this.number_of_players;
        this.players.push(player);
        this.number_of_players++;
    }
    private delete_player(idx : number)
    {
        this.players.splice(idx,1)
    }
    public player_to_delete(nick: string)
    {
        for(let i =0 ;i<this.players.length;i++)
        {
            if(this.players[i].nick==nick)
            {
                this.players[i].active=false;
            }
        }
    }
    public draw_card(): void
    {
        let card = this.deck.pop();
        if(card)
        {
            if(card.rank ==='ace')
            {
                this.players[this.turn.player_idx].hands[this.turn.hand_idx].number_of_full_aces++;
            }
            this.players[this.turn.player_idx].hands[this.turn.hand_idx].cards.push(card)
            this.players[this.turn.player_idx].hands[this.turn.hand_idx].points+=card.point;
            if(this.players[this.turn.player_idx].hands[this.turn.hand_idx].number_of_full_aces>0 && this.is_bust())
            {
                this.players[this.turn.player_idx].hands[this.turn.hand_idx].points-=10;
                this.players[this.turn.player_idx].hands[this.turn.hand_idx].number_of_full_aces--;
            }
        }
        

    }
    private draw_dealer() : void
    {
        let card = this.deck.pop();
        if(card)
        {
            this.dealer.cards.push(card);
            this.dealer.points+=card.point;
        }
    }
    public deal_cards() : void
    {
        for(let i = 0;i<2;i++)
        {
            for(let j = 0;j<this.number_of_players;j++)
            {
                let card = this.deck.pop();
                if(card)
                {
                    if(card.rank === 'ace')
                    {
                        this.players[j].hands[0].number_of_full_aces++;
                    }
                    
                    this.players[j].hands[0].cards.push(card);
                    this.players[j].hands[0].points+=card.point;
                    if(this.players[j].hands[0].points === 22)
                    {
                        this.players[j].hands[0].points=12;
                        this.players[j].hands[0].number_of_full_aces--;
                    }
                }
            }
            let card = this.deck.pop();
            if(card)
            {
                if(card.rank === 'ace')
                {
                    this.dealer.number_of_full_aces++;
                }
                this.dealer.cards.push(card);
                this.dealer.points+=card.point;
                if(this.dealer.points===22)
                {
                    this.dealer.points = 12;
                    this.dealer.number_of_full_aces--;
                }
            }
        }
        this.turn.validMoves=this.valid_moves();
    }

    public next_turn()
    {
        this.turn.timestamp=Date.now();
        if(this.players[this.turn.player_idx].hands.length === this.turn.hand_idx+1)
        {
            if(this.players.length === this.turn.player_idx+1)
            {
                this.turn.player_idx++;
                this.play_dealer();
                return;
            }
            else
            {
                this.turn.player_idx++;
                this.turn.hand_idx = 0;
            }
        }
        else
        {
            this.turn.hand_idx++;
        }
        this.turn.validMoves=this.valid_moves()
        if(this.players[this.turn.player_idx].active===false)
        {
            this.stand();
        }
        if (this.is_blackjack())
        {
            this.next_turn();
        }

    }
    public stand()
    {
        this.next_turn();
    }
    public double()
    {
        this.players[this.turn.player_idx].hands[this.turn.hand_idx].bet*=2;
        this.draw_card();
        this.next_turn();
    }
    private valid_moves() : string[]
    {
        let validm = ["HIT","STAND","DOUBLE"];
        const cards = this.players[this.turn.player_idx].hands[this.turn.hand_idx].cards;
        if (cards.length > 2) {
            return validm;
        }
        if (cards.length === 2 && cards[0].rank === cards[1].rank) {
            validm.push("SPLIT");
        }
        return validm;
    }
    public split()
    {
        let nb_of_aces = 0;
        let card = this.players[this.turn.player_idx].hands[this.turn.hand_idx].cards.pop();
        this.players[this.turn.player_idx].hands[this.turn.hand_idx].points/=2;
        
        if(card)
        {
            if(card.rank === 'ace')
            {
                nb_of_aces++;
            }
        let newHand : GameTypes.Hand =
        {
            bet : this.players[this.turn.player_idx].hands[this.turn.hand_idx].bet,
            cards : [card],
            points : card.point,
            number_of_full_aces : nb_of_aces

        };
        this.players[this.turn.player_idx].hands.push(newHand);
        }

    }
    private is_bust() : boolean
    {
        if(this.players[this.turn.player_idx].hands[this.turn.hand_idx].points > 21)
        {
            return true;
        }
        return false;
    }
    private is_blackjack() : boolean
    {
        if(this.players[this.turn.player_idx].hands[this.turn.hand_idx].cards.length===2 && 
            this.players[this.turn.player_idx].hands[this.turn.hand_idx].points===21
        )
        {
            return true;
        }
        return false;
    }
    private is_dealer_blackjack() : boolean
    {
        if(this.dealer.cards.length===2 && this.dealer.points===21)
        {
            return true;
        }
        return false;
    }
    public hit()
    {
        this.draw_card()
        if(this.is_bust())
        {
            this.next_turn();
        }
    }
    public bet(bet_amount : number,nick : string) : boolean
    {
        for(let i=0;i<this.players.length;i++)
        {
            if(this.players[i].nick === nick)
            {
                if(this.players[i].balance>=bet_amount)
                {
                    this.players[i].balance -=bet_amount
                    this.players[i].hands[0].bet=bet_amount
                    return true;
                }
                else
                {
                    return false;
                }
            }
        }
        return false;
    }
    private win(player_idx: number, hand_idx: number)
    {
        this.players[player_idx].balance += 2*this.players[player_idx].hands[hand_idx].bet;
    }
    private win_bj(player_idx: number, hand_idx: number)
    {
        this.players[player_idx].balance += Math.round(2.5*this.players[player_idx].hands[hand_idx].bet);
    }
    private push(player_idx: number, hand_idx: number)
    {
        this.players[player_idx].balance += this.players[player_idx].hands[hand_idx].bet;
    }
    private update_balances()
    {
        for(let i=0; i<this.number_of_players;i++)
        {
            for(let j=0;j<this.players[i].hands.length;j++)
            {
                let points = this.players[i].hands[j].points;
                const isPlayerBJ = (this.players[i].hands[j].cards.length === 2 && points === 21);

                if(isPlayerBJ && !this.is_dealer_blackjack())
                {
                    this.win_bj(i, j);
                    continue;
                }
                
                if(this.dealer.points <=21)
                {
                    if(points > 21)
                    {
                        
                    }
                    else if(points > this.dealer.points)
                    {
                        this.win(i, j);
                    }
                    else if(points === this.dealer.points)
                    {
                        this.push(i, j);
                    }
                }
                else
                {
                    if(points <=21)
                    {
                        this.win(i, j);
                    }
                }
                
            }
        }
    }
    private play_dealer()
    {
        if(this.is_dealer_blackjack())
        {
            this.update_balances();
            return;
        }
        while(this.dealer.points<17)
        {
            this.draw_dealer();
        }
        this.update_balances()
        for(let i =0;i< this.players.length;i++)
        {
            if(this.players[i].active===false)
            {
                this.delete_player(i);
            }
        }
    }
    public new_game()
    {
        this.deck = shuffle(createDecks(4))
        for(let i =0;i<this.players.length;i++)
        {
            for(let j=0;j<this.players[i].hands.length;j++)
            {   if(j===0)
                {
                this.players[i].hands[j].cards=[];
                this.players[i].hands[j].points=0;
                this.players[i].hands[j].number_of_full_aces=0;
                this.players[i].hands[j].bet = 0;
                }
                else
                {
                    this.players[i].hands.splice(j,this.players[i].hands.length-2);
                }
            }

        }
        this.dealer.cards=[];
        this.dealer.points=0;
        this.dealer.number_of_full_aces=0;
        this.turn.hand_idx=0;
        this.turn.player_idx=0;
    }
    public change_game_phase()
    {
        if(this.game_phase === GameTypes.GamePhase.BETTING)
        {
            this.game_phase= GameTypes.GamePhase.PLAYING;
            this.deal_cards();
        }
        if(this.game_phase === GameTypes.GamePhase.PLAYING)
        {
            this.game_phase=GameTypes.GamePhase.BETTING;
            this.new_game();
        }
    }
}
