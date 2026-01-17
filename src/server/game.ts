import * as GameTypes from "../shared/types";

const d = new Date()
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
                if (rank === 'Q' || rank === 'K' || rank === 'J') {
                    points = 10;
                }
                else if (rank === 'A') {
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
    function func(a: any, b: any): number {
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
        this.timestamp = d.getTime();
        this.validMoves=[];
    }
}
export class Player implements GameTypes.Player {
    public nick: string
    public hands: GameTypes.Hand[]
    public balance: number
    public player_idx: number

    constructor(nick: string) {
        this.nick = nick
        this.hands = []
        this.balance = 1000
        this.player_idx = 0
    }
}

export class Game {

    private deck : GameTypes.Card[]
    private players : Player[]
    private dealer : GameTypes.Dealer

    public uuid: string
    public number_of_players : number
    public max_players = 5;
    public turn = new Turn()

    constructor()
    {
        this.deck = shuffle(createDecks(4));
        this.players = [];
        this.dealer = { cards: [], points: 0 }
        this.number_of_players = 0
        this.uuid = globalThis.crypto.randomUUID()
    }

    public add_player(player : Player): void
    {
        player.player_idx = this.number_of_players;
        this.players.push(player);
        this.number_of_players++;
    }

    public draw_card(): void
    {
        let card = this.deck.pop();
        if(card)
        {
            if(this.turn.player_idx == this.number_of_players)
            {
                this.dealer.cards.push(card)
                this.dealer.points+=card.point
            }
            else
            {
                this.players[this.turn.player_idx].hands[this.turn.hand_idx].cards.push(card)
                this.players[this.turn.player_idx].hands[this.turn.hand_idx].points+=card.point
            }
        }
        this.turn.validMoves=this.valid_moves();

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
                    this.players[j].hands[0].cards.push(card);
                    this.players[j].hands[0].points+=card.point
                }
            }
            let card = this.deck.pop();
            if(card)
            {
                this.dealer.cards.push(card);
                this.dealer.points+=card.point;
            }
        }
    }

    public next_turn()
    {
        this.turn.timestamp=d.getTime();
        if(this.players[this.turn.player_idx].hands.length == this.turn.hand_idx+1)
        {
            if(this.players.length == this.turn.player_idx+1)
            {
                this.play_dealer()
            }
            else
            {
                this.turn.player_idx++;
            }
        }
        else
        {
            this.turn.hand_idx++;
        }
        this.turn.validMoves=this.valid_moves()
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
        if(this.players[this.turn.player_idx].hands[this.turn.player_idx].cards.length > 2)
        {
            return validm
        }
        if(this.players[this.turn.player_idx].hands[this.turn.player_idx].cards[0].rank == this.players[this.turn.player_idx].hands[this.turn.player_idx].cards[1].rank)
        {
            validm.push("SPLIT");
        }
        return validm;
    }
    public split()
    {
        let card = this.players[this.turn.player_idx].hands[this.turn.hand_idx].cards.pop();
        this.players[this.turn.player_idx].hands[this.turn.hand_idx].points/=2;
        if(card)
        {
        let newHand : GameTypes.Hand = {
            bet : this.players[this.turn.player_idx].hands[this.turn.hand_idx].bet,
            cards : [card],
            points : card.point

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
        if(this.players[this.turn.player_idx].hands[this.turn.hand_idx].cards.length==2 && 
            this.players[this.turn.player_idx].hands[this.turn.hand_idx].points==21
        )
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
            this.next_turn;
        }
    }
    private win()
    {
        this.players[this.turn.player_idx].balance += 2*this.players[this.turn.player_idx].hands[this.turn.hand_idx].bet;
    }
    private win_bj()
    {
        this.players[this.turn.player_idx].balance += Math.round(2.5*this.players[this.turn.player_idx].hands[this.turn.hand_idx].bet);
    }
    private push()
    {
        this.players[this.turn.player_idx].balance += this.players[this.turn.player_idx].hands[this.turn.hand_idx].bet;
    }
    /*private update_balances()
    {
        for(let i=0; i<this.number_of_players;i++)
        {
            for(let j=0;j<thi)
        }
    }*/
    public play_dealer()
    {

    }
}
