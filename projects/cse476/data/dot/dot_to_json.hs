{-# LANGUAGE OverloadedStrings #-}
module DotToJSON
(dot2json, dotParser) where

import Data.Either (partitionEithers)
import System.Environment (getArgs)
import Text.Parsec
import Data.Aeson
import Data.Aeson.Encode (encode)
import Data.Aeson.Types (Pair)
import Data.ByteString.Lazy as B (writeFile, ByteString)
import Control.Monad
import Data.Text (pack)


dot2json :: FilePath -> String -> Either ParseError ByteString
dot2json fname txt = fmap encode $ runParser dotParser () fname txt

type Parser a = Parsec String () a

data DotFile = DotFile {
        name :: String, nodes :: [Value], links :: [Value]
    } deriving (Show, Eq)

instance ToJSON DotFile where
    toJSON (DotFile name nodes links) =
        object ["name".=name, "nodes".=nodes, "links".=links]

dotParser :: Parser DotFile
dotParser = do
    ignoredText
    string "graph"
    ignoredText
    name <- parseName
    ignoredText
    char '{'
    ignoredText
    (nodes, links) <- parseNodesAndLinks
    ignoredText
    char '}'
    ignoredText
    return $ DotFile name nodes links

ignoredText = void $ many $ try ((void space) <|> comment)
comment = do string "//"
             void $ manyTill anyChar (try (char '\n'))

parseNodesAndLinks :: Parser ([Value], [Value])
parseNodesAndLinks = fmap partitionEithers $ many $
    (try $ parseLink >>= return . Right)
    <|>
    (try $ parseNode >>= return . Left)

parseName = many1 (alphaNum <|> char '_') <?> "name"

parseNode :: Parser Value
parseNode = do
    ignoredText
    name <- parseName
    ignoredText
    attrs <- attrList
    ignoredText
    char ';'
    ignoredText
    return $ object $ ["name" .= name] ++ attrs

parseLink :: Parser Value
parseLink = do
    ignoredText
    source <- parseName
    try ignoredText
    string "--"
    try ignoredText
    target <- parseName
    ignoredText
    attrs <- attrList
    ignoredText
    char ';'
    ignoredText
    return $ object $ ["target" .= target, "source" .= source] ++ attrs


attrList :: Parser [Pair]
attrList = (do
    char '['
    attrs <- (do
        name <- parseName
        ignoredText
        char '='
        ignoredText
        val <- parseName
        ignoredText
        return (pack name .= val)
        ) `sepBy` (char ',')
    char ']'
    return attrs) <|> (return [])

main = do
    as <- getArgs
    if (tail as /= []) then putStrLn "USAGE: program fname.dot"
    else do
        let firstArg = head as
            fname = reverse . drop 4 . reverse $ firstArg
        dotfile <- Prelude.readFile (fname ++ ".dot")
        either print (B.writeFile $ (fname ++ ".json"))
            (dot2json (fname ++ ".dot") dotfile)
