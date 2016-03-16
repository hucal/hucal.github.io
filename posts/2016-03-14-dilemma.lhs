---
title: Evolving New Strategies in Haskell
author: Hugo Rivera
date: March 13, 2016
tags: [Haskell, Genetic Algorithm, Iterated Prisoner's Dilemma, Prisoner's Dilemma]
description: This document implements a genetic algorithm that searches for strategies to play the iterated prisoner's dilemma as described in Axelrod (1987) and in Mitchell (1995).
---

== Genetic Algorithms

A **genetic algorithm** is a biologically inspired way of finding the best
solution to a computational problem. It works by encoding the solution to a
problem as an artificial **genome**. The algorithm keeps a **population**,
which is made out of many genomes. GAs are iterative algorithms, meaning they
start by guessing a solution (by generating many random genomes) and then
they improve that guess until a good enough solution is found or until
computation time runs out. The solutions, that is, the genomes are improved
in a three step process:

1. The genomes in the population are scored and the ones that offer the best
solutions are more likely to be **selected** for the next step.
2. Genomes are paired randomly for an operation called **crossover** where two
genomes are combined to make similar genomes. This is analogous to sexual
reproduction.
3. These new genomes replace the current population. There is a chance that
some of them are chosen to be **mutated**, that is, they are modified randomly.
This can be interpreted as an insurance policy that helps keep a diverse
population.

See "Genetic Algorithms" (1992) by John Holland for a detailed description from
one of the creators of this technique. I am following Melanie Mitchell's
tutorial "Genetic Algorithms: An Overview" (1995).

This document is generated from a literate Haskell file, meaning this
is both a computer program and an essay.
Now that you know that, you should also know literate Haskell documents make
friendlier computer programs than literary works so please excuse this
necessary fragment of Haskell code.

> import Control.Monad               ((<=<))
> import Control.Monad.State         (StateT(..), get, put)
> import Control.Monad.Writer.Strict (Writer, runWriter, tell)
> import Text.Printf                 (printf)
> import System.Random   (Random(..), RandomGen, randoms, next, mkStdGen)
> import qualified Data.Map as M     (Map, insert, (!), singleton, elems)

== The Prisoner's Dilemma

The Prisoner's Dilemma is a two player game. Suppose two people get arrested
for committing a crime together. They are brought into separate rooms and
offered the choice to cooperate with the authorities by testifying against
the other suspect. They know that if they both cooperate, they will be
discredited and get 4 years in prison. If only one cooperates, that person
will get no jail time while their partner receives 5 years. If both choose to
remain silent or "defect" they will receive 1 year in prison.
In this game, a step is represented by two moves: cooperation or defection.

> data Move = C | D deriving (Show, Eq, Bounded)
> type GameStep = (Move, Move)

A convenient scoring system assigns high scores to low jail time; i.e.
if player 1 chooses to cooperate while player 2 defects then player 1 gets 5
points and player 2 gets 0 points. This scoring system can be encoded in a
matrix that reports the score of both players for every possible step of the
game:

> type ScoreMatrix = [(GameStep, (Integer, Integer))]
> defaultScoreMatrix :: ScoreMatrix
> defaultScoreMatrix = [ ((C, C), (1, 1))
>                      , ((C, D), (5, 0))
>                      , ((D, C), (0, 5))
>                      , ((D, D), (4, 4)) ]

In the Iterated Prisoner's dilemma this game can be played multiple times to
try to achieve the highest score.
Robert Axelrod had extensively studied this game when he held a competition to
find the most effective strategy. Computer hobbyists and researchers from many
scientific disciplines submitted a large variety of programs. One of these
played random moves, another modeled the opponent as a Markov process to try
to predict the next move.

Despite the complicated strategies, the winner of this competition was a simple
strategy called **tit-for-tat** that did nothing but mimic the opponent's
last move. If the opponent cooperated with the authorities in the previous
game, then the player chooses to cooperate this game. If the opponent defected
in the previous game, the player would punish that with a defection of its own.
A second competition was held and, again, tit-for-tat beat all of its
opponents.

== Finding an Optimal Strategy

After these competitions, Axelrod wanted to create a computer program that
automatically discovered strategies for playing the Iterated Prisoner's
Dilemma. He decided to construct a genetic algorithm for finding these
solutions. The most important part is encoding the solutions.
Let's encode the easy part first, a population is a list of genomes.

> type Population = [Genome]

But what is a genome? Consider the tit-for-tat strategy. It needs to store one
previous move. In general, the entire previous **step**, that is, the previous
move made by the opponent and the previous move made by the strategy may be
needed. So tit-for-tat actually has four choices to make.
These are:

1. If C, C then C
2. If C, D then D
3. If D, C then C
4. If D, D then D

where the last element is the move tit-for-tat makes this round,
the first element of the tuple represents the move made by the strategy
and the second is the move made by the opponent on the previous round.

The first move is a special case for this kind of strategy. The tit for tat
strategy chooses to cooperate on the first game. So we can assume that the
"0th" move is any move where the opponent chose to cooperate, let's make it
C, C. This is the information we must store:

> titForTat1 :: Genome
> titForTat1 = Genome [C, D, C, D] [(C, C)]

A genome that encodes a strategy which needs to remember $n$ steps of the
game needs a list of $2n$ moves or $n$ move pairs that it will assume were the
previous $n$ moves and a list of $2^{2n}$ moves to make for each of the
possible histories.

> data Genome = Genome { strategy :: [Move], assumedMoves :: [GameStep] }
>             deriving (Show, Eq)

In order to facilitate crossover with strategies of any length, we can generalize
the tit-for-tat strategy to work for any length of assumed history.
For example, a tit-for-tat strategy that stores 2 previous steps works like this:

1. if the last 2 steps were C,C and C,C then C
2. if C,C and C,D then D
3. if C,C and D,C then C
4. if C,C and D,D then D
5. if C,C and D,D then D
6. if C,D and C,C then C
7. if C,D and C,D then D

And so on for a total of $2^{2\cdot 2} = 16$ possible moves. Mutual cooperation
is assumed at the beginning of the game. Then tit-for-tat can be generalized
by as a strategy of alternating Cs and Ds with an assumed history of all
Cs:

> titForTat :: Int -> Genome
> titForTat h = Genome (take (2 ^ (2 * h)) $ cycle [C, D]) (replicate h (C, C))

Let's define more strategies.
These are inspired by lists posted on
<https://www.bc.edu/content/dam/files/schools/cas_sites/cs/local/bach/2006/06DanielScali.pdf>
and
<http://www.prisoners-dilemma.com/competition.html>.
The complement of a genome will be a useful operation in defining these.
To find the complement of genome, find the complement of all of its moves.
To do that, change Ds to Cs and Cs to Ds.

> instance Invertible Genome where
>   complement (Genome strat hist) = Genome (complement strat) (complement hist)
> instance Invertible Move where
>   complement C = D
>   complement D = C

Here is a population of genomes which need to know at least one previous step
of the game.

> defaultCompetition :: Int -> Population
> defaultCompetition h = let
>   sLen = 2 ^ (2 * h)

Two strategies always cooperate or always defect.
A variant of the TFT called the Suspicious TFT defects on the first move.
The grim trigger strategy cooperates until the opponent defects.
The DPC strategy only defects if the opponent has not cooperated in
the previous h moves:

>   allC          = Genome (replicate sLen C) (replicate h (C,C))
>   allD          = complement allC
>   suspiciousTFT = (titForTat h) { assumedMoves = complement (assumedMoves
>                                                              (titForTat h)) }
>   grimTrigger   = allC { strategy = C : replicate (sLen - 1) D }
>   dpc           = allC { strategy = replicate (sLen - 1) C ++ [D] }

The complements of the TFT strategies are also added.

>   in [allC, allD, grimTrigger, dpc, titForTat h, suspiciousTFT,
>       complement suspiciousTFT, complement $ titForTat h]

=== Scoring

The scoring matrix may be used to score the moves of the two players.
The matrix is scanned to find the given step and the corresponding score for
each player.

> scoreMoves :: ScoreMatrix -> GameStep -> (Integer, Integer)
> scoreMoves [] _ = (0, 0)
> scoreMoves ((possibleMove, score) : scoreMatrix) movePair =
>   if movePair == possibleMove
>   then score else scoreMoves scoreMatrix movePair

> compareGenomes :: ScoreMatrix -> Integer -> Genome -> Genome -> (Integer, Integer)
> compareGenomes scoreMatrix gameLength genomeA genomeB =
>   let toBinary :: Num n => [GameStep] -> n
>       toBinary = fst . foldr (\move (b, place) ->
>                        (if move == D then b + place else b, place * 2))
>                  (0, 1) . flattenPairs
>       histALen = length $ assumedMoves genomeA
>       histBLen = length $ assumedMoves genomeB

TODO
pick a move based on the past h moves:
past h moves form a binary string b
pick the bth element in the genome
for the first few moves, use the first h elements of the genome as hypothetical previous moves

>       scoreWithHistory histA histB =
>         let moveA = (strategy genomeA !!) . toBinary . take histALen $ histA
>             moveB = (strategy genomeB !!) . toBinary . take histBLen $ histB
>         in ((moveA, moveB), scoreMoves scoreMatrix (moveA, moveB))
>       scoreMatch i result@((hA, hB), (sA, sB))
>        | i >= gameLength = result
>        | otherwise       = let (newMove, (sA', sB')) = scoreWithHistory hA hB
>                            in  scoreMatch (i + 1) ((newMove:hA, newMove:hB),
>                                                    (sA + sA', sB + sB'))

  TODO
  make where clause
initial history and score

>    in snd $ scoreMatch 0
>       ((assumedMoves genomeA, assumedMoves genomeB),
>        (0, 0))

> scoreGenome :: ScoreMatrix -> Integer -> Population -> Genome -> Double
> scoreGenome scoreMatrix gameLength competition genome =

The main player, Player A, is the first element of the tuple.

>   let scoreAgainst gA = fromIntegral . fst . compareGenomes scoreMatrix gameLength gA
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

It will be useful to store the statistics of all trials using the Writer
monad. Random numbers are easier to generate with the help of the State monad.

> data Statistics = Statistics
>      { mutations :: [Double], ranks :: [[Double]],
>        score :: [[Double]], cdProportion :: [[Double]] }
>      deriving (Show, Eq)
> type App g = StateT g (Writer Statistics)

The selection operator makes use of both features.
It is defined as follows.... TODO

> select :: RandomGen g => Integer -> Population -> Population -> App g [(Genome, Genome)]
> select gameLength competition pop = do
>   let scores = zip pop $ map (scoreGenome defaultScoreMatrix gameLength competition) pop
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
>             $ assumedMoves g
>     return $ if which
>            then Genome (strategy g) hist'
>            else Genome strat' (assumedMoves g)

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
>       genLimit = 100 :: Int
>       gameLength = 1000
>       histLimit = 2
>       popLimit = 50
>       (pop, statistics) = simulateWith seed histLimit gameLength genLimit popLimit
>   mapM_ (\(genome, score) -> putStrLn $ show score ++ " " ++ showGenome genome) $ zip pop (map (scoreGenome defaultScoreMatrix gameLength (defaultCompetition histLimit)) pop)
>   putStrLn $ printf
>           "generations: %d,  population limit: %d, seed: %d" genLimit popLimit seed
>   putStrLn (showStatistics statistics)

=== Results

A sample run with seed set to
  TODO analyze results



== Theory
Why do genetic algorithms converge to good answers?
For the experiments where 3 steps of history were kept there were
about as many solutions as there are grains of sand on the earth, that is,
$2^{70} \approx 10^{21}$ solutions and yet the GA was able to find good
solutions in a low number of generations. The key part is that small changes in
the genotype result in small changes in the phenotype.

The tit-for-tat strategy can be classified by many patterns.
For example, the pattern C\*C\*... where \* is any move.
Strategies in this pattern are those that cooperate if the opponent cooperated
on the first move.
Another theory that helps explain the effectiveness of GAs is the building
block hypothesis:

*By processing a single genome, a genetic algorithm tries exponentially many
genome patterns in the solution space.*

GAs explore large subsets of the solution space by simultaneously analyzing
huge numbers of patterns at a time.
We can construct a mathematical argument as follows.

== Necessary Code

These functions are frequently used.

> flattenPairs = foldr (\(a,b) l -> a:b:l) []
> unflattenPairs (a:b:l) = (a,b) : unflattenPairs l
> unflattenPairs _ = []

=== Haskell Typeclasses

How to randomly select a move.

> instance Random Move where
>   randomR (lo, hi) g =
>     let (n, g') = next g
>     in (if n `mod` 2 == 0 then lo else hi, g')
>   random = randomR (minBound, maxBound)

Finding the complement of a genome is a useful operation.

> class Invertible a where
>   complement :: a -> a
> instance Invertible a => Invertible [a] where
>   complement = map complement
> instance (Invertible a, Invertible b) => Invertible (a,b) where
>   complement (a, b) = (complement a, complement b)

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
> getProportions g = let l = strategy g ++ flattenPairs (assumedMoves g)
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
From <http://okmij.org/ftp/Haskell/perfect-shuffle.txt>

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

<!--
TODO

1. elitism
2. visualize and plot modifications
   D3?
   show proportion of defect/coop over time (slideshow)
     highlight tit for tat strategies

   illustrate crossover operation
   diagrams?
-->
