export type Card = {
    rank : string
    suit : string
    point : number
}
export type Hand = 
{
    bet : number
    cards : Card[]
    points : number
}
export type Dealer = {
    cards : Card[]
    points : number

}