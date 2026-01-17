import * as GameTypes from "../shared/types";

function createDecks(numberOfDecks: number = 4): GameTypes.Card[] {
    const deck: GameTypes.Card[] = [];
    const SUITS = ['H','D','S','C'];
    const RANKS = ['2','3','4','5','6','7','8','9','10','J','Q','K','A'];
    
    for(let i=0; i<numberOfDecks;i++)
    {
        for(const suit of SUITS) {
            for(const rank of RANKS)
            {
                let points = 0;
                if(rank === 'Q' || rank === 'K' || rank === 'J')
                {
                    points = 10;
                }
                else if(rank === 'A')
                {
                    points = 11;
                }
                else
                {
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
function shuffle(deck : GameTypes.Card[]): GameTypes.Card[]
{
    deck = deck.sort(func)
    function func(a: any ,b: any): number{
        return 0.5 - Math.random();
    } 

    return deck;
}
export class Player {
    public nick : string
    public hands : GameTypes.Hand[]
    public balance : number
    public player_idx : number

    constructor(nick : string)
    {
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
    private number_of_players : number
    private uid: string
    public max_players = 5;
    constructor()
    {
        this.deck = shuffle(createDecks(4));
        this.players = [];
        this.dealer = {cards: [],points: 0}
        this.number_of_players = 0
        this.uid = globalThis.crypto.randomUUID()
    }
    public add_Player(player : Player): void
    {
        player.player_idx = this.number_of_players;
        this.players.push(player);
        this.number_of_players++;
    }
    public drawCard(player_idx: number,hand_idx : number): void
    {
        let card = this.deck.pop();
        if(card)
        {
            if(player_idx == this.number_of_players)
            {
                this.dealer.cards.push(card)
            }
            else
            {
            this.players[player_idx].hands[hand_idx].cards.push(card)
            }
        }

    }
    public deal_cards() : void
    {
        for(let i = 0;i<2;i++)
        {
            for(let j = 0;j<=this.number_of_players;j++)
            {
                this.drawCard(j,0);
            }
        }
    }

}
