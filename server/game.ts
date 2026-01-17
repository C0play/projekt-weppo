import * as GameTypes from "../common/types";

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
export class Game {
    private deck : GameTypes.Card[]
    private players : GameTypes.Player[]
    private dealer : GameTypes.Dealer

    constructor()
    {
        this.deck = shuffle(createDecks(4));
        this.players = [];
        this.dealer = {cards: [],points: 0}
    }
    public add_Player(Player: GameTypes.Player): any
    {
        this.players.push(Player)
    }

}
/*const deck : GameTypes.Card[] = shuffle(createDecks(4))
console.log(deck)*/