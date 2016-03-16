---
title: Evolving New Strategies in Haskell
author: Hugo Rivera
date: March 13, 2016
tags: [Haskell, Genetic Algorithm]
description: This document implements a genetic algorithm that searches for strategies to play the iterated prisoner's dilemma as described in Axelrod (1987) and in Mitchell (1995).
---

== The Prisoner's Dilemma

  TODO sources
TODO describe the game
TODO describe competition

== Finding an Optimal Strategy

=== Genetic Algorithms
TODO describe GA

=== Theory
$$\left[ \frac{e - \mathbb{E} l}{\sigma_l} \right]$$

TODO why does GA work?

Necessary Haskell code:

> import Control.Monad
> import Control.Monad.State
> import Control.Monad.Writer.Strict
> import System.Random
> import qualified Data.Map as M
> import Data.List
> import Text.Printf

=== Types

There are two possible moves: Cooperate or Defect.

> data Move = C | D deriving (Show, Eq, Bounded)

This data type will be frequently used to represent a move in a two player
game.

> type MovePair = (Move, Move)

TODO
A genome stores ...

> data Genome = Genome { strategy :: [Move], assumedHistory :: [MovePair] }
>             deriving (Show, Eq)
> type Population = [Genome]

For example, this strategy needs to look at the previous game to decide how
to move. It simply repeats the opponent's last move. A history of mutual
cooperation is assumed.

> titForTat1 :: Genome
> titForTat1 = Genome [C, D, C, D] [(C, C)]

TODO
in general

> titForTat :: Int -> Genome
> titForTat h = undefined

TODO let's define a set of competitors

Some strategies from
<https://www.bc.edu/content/dam/files/schools/cas_sites/cs/local/bach/2006/06DanielScali.pdf>
and
<http://www.prisoners-dilemma.com/competition.html>

> defaultCompetition :: Int -> Population
> defaultCompetition h = [allC, allD, grimTrigger, dpc

 >                        , pavlov,
 >                         titForTat h, complement $ titForTat h, suspiciousTFT,
 >                         complement suspiciousTFT

>         ] where
>         hLen = 2 * h
>         sLen = 2 ^ hLen
>         allC = Genome (replicate sLen C) (unflattenPairs $ replicate hLen C)
>         allD = complement allC

TFT but defects on first move.

>         suspiciousTFT = (titForTat h) { assumedHistory = complement
>                                       $ assumedHistory (titForTat h)}

Cooperation until the opponent defects.

>         grimTrigger = allC { strategy = C : replicate (sLen - 1) D }

Cooperation if the opponent has ever cooperated.

TODO FIXME

>         dpc = allC { strategy = replicate (sLen - 1) C ++ [D] }

if(oppHistory[moveNumber-1] == myHistory[moveNumber-1]) then C

>         pavlov = undefined

TODO some more detail
Book-keeping.

> data Statistics = Statistics
>      { mutations :: [Double], ranks :: [[Double]],
>        score :: [[Double]], cdProportion :: [[Double]] }
>      deriving (Show, Eq)

> type App g = StateT g (Writer Statistics)


=== Scoring

TODO the scoring matrix for this game is

> type Payoffs = [(MovePair, (Integer, Integer))]
> defaultPayoffs :: Payoffs
> defaultPayoffs = [ ((C, C), (3, 3))
>                  , ((C, D), (5, 0))
>                  , ((D, C), (0, 5))
>                  , ((D, D), (1, 1)) ]

This matrix may be used in a straightforward way to score the moves of the two
players.

> scoreMoves :: Payoffs -> MovePair -> (Integer, Integer)
> scoreMoves [] _ = (0, 0)
> scoreMoves ((possibleMove, score) : payoffs) movePair =
>   if movePair == possibleMove
>   then score else scoreMoves payoffs movePair

> compareGenomes :: Payoffs -> Integer -> Genome -> Genome -> (Integer, Integer)
> compareGenomes payoffs gameLength genomeA genomeB =

TODO genomes should be of length 2^(length of the genome's assumedHistory)

>   let toBinary :: Num n => [MovePair] -> n
>       toBinary = fst . foldr (\move (b, place) ->
>                        (if move == D then b + place else b, place * 2))
>                  (0, 1) . flattenPairs
>       histALen = length $ assumedHistory genomeA
>       histBLen = length $ assumedHistory genomeB

TODO
pick a move based on the past h moves:
past h moves form a binary string b
pick the bth element in the genome
for the first few moves, use the first h elements of the genome as hypothetical previous moves

>       scoreWithHistory histA histB =
>         let moveA = (strategy genomeA !!) . toBinary . take histALen $ histA
>             moveB = (strategy genomeB !!) . toBinary . take histBLen $ histB
>         in ((moveA, moveB), scoreMoves payoffs (moveA, moveB))
>       scoreMatch i result@((hA, hB), (sA, sB))
>        | i >= gameLength = result
>        | otherwise       = let (newMove, (sA', sB')) = scoreWithHistory hA hB
>                            in  scoreMatch (i + 1) ((newMove:hA, newMove:hB),
>                                                    (sA + sA', sB + sB'))

  TODO
  make where clause
initial history and score

>    in snd $ scoreMatch 0
>       ((assumedHistory genomeA, assumedHistory genomeB),
>        (0, 0))

> scoreGenome :: Payoffs -> Integer -> Population -> Genome -> Double
> scoreGenome payoffs gameLength competition genome =

The main player, Player A, is the first element of the tuple.

>   let scoreAgainst gA = fromIntegral . fst . compareGenomes payoffs gameLength gA
>       scores = map (genome `scoreAgainst`) competition
>   in sum scores / (fromIntegral $ length scores)

==== Selection

  TODO make clearer
Mean individuals receive one mating. Individuals one standard deviation
above the fitness level receive two matings and those below the fitness level
receive no matings. An individual may mate with itself.

> mean l = sum l / (fromIntegral $ length l)
> stddev l = let m = mean l in sqrt $ (sum [(e - m)**2 | e <- l] ) / (fromIntegral $ length l)

[(a,3),(b,2),(c,-1)] -> [a,a,a,b,b]

> rankByStddev getNum l =
>   let lNum = map getNum l
>   in [round $ ((getNum e) - mean lNum) / (stddev lNum) | e <- l]
> replicateBy f g l = concat [replicate (f e) (g e) | e <- l]


> select :: RandomGen g => Integer -> Population -> Population -> App g [(Genome, Genome)]
> select gameLength competition pop = do
>   let scores = zip pop $ map (scoreGenome defaultPayoffs gameLength competition) pop
>       ranks = zip scores (rankByStddev snd scores)

  TODO
EXPLAIN RANKING

>       sorted = fst . unzip $ replicateBy ((+1).snd) fst $ ranks
>   tell $ mempty {ranks = [map fromIntegral . snd $ unzip ranks],
>                  score = [snd $ unzip scores]}


>   s1 <- shuffle sorted
>   s2 <- shuffle sorted



>   return $ zip (s1 ++ pop) (s2 ++ pop)

==== Crossover

Individuals produce two offspring upon mating. This operation is a way of
combining the chromosones of both genomes. It is performed randomly.

TODO

one-point split both the history and the strategy

> crossover :: RandomGen g => Genome -> Genome -> App g (Genome, Genome)
> crossover (Genome sA hA) (Genome sB hB) = do
>   stratIx <- (st randomR) (0, -1 + min (length sA) (length sB))
>   histIx  <- (st randomR) (0, -1 + min (length hA) (length hB))

[[-5,-4,-3,-2,-1],[1,-4,-3,-2,-1],[1,2,-3,-2,-1],[1,2,3,-2,-1],[1,2,3,4,-1],[1,2,3,4,5]]

>   let genome1 = Genome (take stratIx sA ++ drop stratIx sB)
>                        (take histIx hA ++ drop histIx hB)
>       genome2 = Genome (take stratIx sB ++ drop stratIx sA)
>                        (take histIx hB ++ drop histIx hA)
>   return (genome1, genome2)

==== Mutation

Mutation occurs by randomly changing a very small proportion of the
C's and D's in either the genome's strategy or in its assumed history.
This is a type of insurance policy against stagnation.

> mutate :: RandomGen g => Double -> Genome -> App g Genome
> mutate mutateProb g = do

  TODO
Inclusive 1 to 10

>   n <- (st randomR) (0,1) :: RandomGen g => App g Double
>   if n > mutateProb
>   then tell (mempty {mutations = [0]})
>     >> return g

If a mutation must occur, select whether to mutate the assumed history or the
genome's strategy.

TODO also use tell to report the number of mutations

>   else do
>     tell (mempty {mutations = [1]})
>     which <- st_ random
>     strat' <- flipOne $ strategy g
>     hist'  <- (return . unflattenPairs) <=< (flipOne . flattenPairs)
>             $ assumedHistory g
>     return $ if which
>            then Genome (strategy g) hist'
>            else Genome strat' (assumedHistory g)

> flipOne :: RandomGen g => [Move] -> App g [Move]
> flipOne [] = return []
> flipOne (x:xs) = do
>   flip_ <- st_ random
>   if flip_
>   then return $ (complement x) : xs
>   else do rest <- flipOne xs
>           return (x : rest)

=== The Simulation

The initial population is randomly generated.

> randomPop :: RandomGen g => Int -> Int -> App g Population
> randomPop maxHist n' = get >>= return . go n' . randoms
>  where go n randoms |  n <= 0 = []
>                     | otherwise =
>                        let nHist = 2 * maxHist
>                            nStrat = 2 ^ nHist
>                            hist = take nHist randoms
>                            strat = take nStrat $ drop nHist randoms
>                            g' = Genome strat (unflattenPairs hist)
>                        in g' : go (n - 1) (drop (nStrat + nHist) randoms)

  TODO clearer, less space
To run the simulation: generate a random population of size 20 where genomes
need 3 previous steps, run a 50 step simulation, and print the results.

> simulateWith seed histLimit gameLength genLimit popLimit =
>   let competition = defaultCompetition histLimit
>       run n pop
>        | n <= 0 = do

TODO have a better tell function.... very readable

>            tell $ mempty { cdProportion = [map getProportions pop] }
>            return pop
>        | otherwise = do
>          tell $ mempty { cdProportion = [map getProportions pop] }

The previously defined functions are now applied to generate a new population.
A subset of the population is paired and the crossover operation is performed.

>          selPop <- select gameLength competition pop
>          crossPop <- mapM (uncurry crossover) selPop

The population is truncated and mutated. The highest scoring individuals are
kept.

>          mutPop <- (mapM (mutate 0.3) . flattenPairs . take popLimit) crossPop
>          run (n - 1) mutPop

Continue. The result is the final population and all statistics.

>       ((pop, _), statistics) = runWriter $ flip runStateT (mkStdGen seed)
>             (randomPop histLimit popLimit >>= run genLimit)
>       in (pop, statistics)

Finally, print statistics and results.

> main = do
>   let seed = 0
>       genLimit = 200 :: Int
>       gameLength = 150
>       histLimit = 2
>       popLimit = 20
>       (pop, statistics) = simulateWith seed histLimit gameLength genLimit popLimit
>   mapM_ (\(genome, score) -> putStrLn $ show score ++ " " ++ showGenome genome) $ zip pop (map (scoreGenome defaultPayoffs gameLength (defaultCompetition histLimit)) pop)
>   putStrLn $ printf
>           "generations: %d,  population limit: %d, seed: %d" genLimit popLimit seed
>   putStrLn (showStatistics statistics)

=== Results

A sample run with seed set to
  TODO analyze results

== Necessary Code

These functions are frequently used.

> flattenPairs = foldr (\(a,b) l -> a:b:l) []
> unflattenPairs (a:b:l) = (a,b) : unflattenPairs l
> unflattenPairs _ = []

=== Typeclass Instances

How to randomly select a move.

> instance Random Move where
>   randomR (lo, hi) g =
>     let (n, g') = next g
>     in (if n `mod` 2 == 0 then lo else hi, g')
>   random = randomR (minBound, maxBound)

Finding the complement of a genome is a useful operation.

> class Invertible a where
>   complement :: a -> a
> instance Invertible Move where
>   complement C = D
>   complement D = C
> instance Invertible a => Invertible [a] where
>   complement = map complement
> instance (Invertible a, Invertible b) => Invertible (a,b) where
>   complement (a, b) = (complement a, complement b)
> instance Invertible Genome where
>   complement (Genome strat hist) = Genome (complement strat) (complement hist)

How to add to the statistics.

> instance Monoid Statistics where
>   mempty = Statistics mempty mempty mempty mempty
>   mappend (Statistics a1 a2 a3 a4) (Statistics b1 b2 b3 b4) =
>     Statistics (a1 `mappend` b1) (a2 `mappend` b2)
>                (a3 `mappend` b3) (a4 `mappend` b4)

=== Utility Functions

Pretty printing.

> showGenome (Genome strat hist) = show strat ++ " " ++ show hist

> showStatistics stat =
>     printf ("Mean scores %s."
>        ++ "\nMax scores %s."
>        ++ "\nMax ranks %s."
>        ++ "\nMean mutation rate: %f, total mutations: %f."
>        ++ "\nMean proportion C/D: %s")
>     (show . map mean $ score stat)
>     (show . maxDouble $ score stat)
>     (show . maxDouble $ ranks stat)
>     (mean $ mutations stat) (sum $ mutations stat)
>     (show . map mean $ cdProportion stat)
>     where maxDouble = map (foldl (\e a -> if e > a then e else a) (-1E1000))

Find the proportion C/D.

> getProportions :: Genome -> Double
> getProportions g = let l = strategy g ++ flattenPairs (assumedHistory g)
>                        len = fromIntegral $ length l
>                        nC = fromIntegral . length $ filter (==C) l
>                        nD = len - nC
>                    in nC / nD

Convert a tuple based function that depends on a RandomGen into a stately
function.

> st :: RandomGen g => (a -> g -> (b, g)) -> a -> App g b
> st f a = get >>= return . f a >>= \(b, g) -> put g >> return b
> st_ f = st (const f) ()


Shuffle a list.
<http://okmij.org/ftp/Haskell/perfect-shuffle.txt>

> shuffle :: RandomGen g => [a] -> App g [a]
> shuffle [] = return []
> shuffle l = do
>   gen <- get
>   let (result, gen') = foldl fisherYatesStep
>             (M.singleton 0 (head l), gen) (zip [1..] (tail l))
>   put gen'
>   return (M.elems result)
>   where fisherYatesStep :: RandomGen g =>
>                            (M.Map Int a, g) -> (Int, a) -> (M.Map Int a, g)
>         fisherYatesStep (m, gen) (i, x) =
>           let (j, gen') = randomR (0, i) gen
>           in ((M.insert j x . M.insert i (m M.! j)) m, gen')

TODO

1. elitism
2. visualize and plot modifications
   D3?
   show proportion of defect/coop over time (slideshow)
     highlight tit for tat strategies

   illustrate crossover operation
   diagrams?


