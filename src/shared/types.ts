export type Card = {
    rank : string
    suit : string
    point : number
}
export type Dealer = {
    cards : Card[]
    points : number

}
export type Player = {
    nick : string
    cards : Card[]
    points : number
}