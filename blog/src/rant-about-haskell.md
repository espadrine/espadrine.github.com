# Rant About Haskell

I will fall in the typical hole of "programmers that played with a language and believe they know why that language is bad".

However, I actually think a lot of things about Haskell are outstanding, starting with its well-designed type system, going on with its healthy library and ending with its excellent set of tools.

What makes Haskell bad in my opinion is threefold:

- The syntax is awkward,
- Tracking state is made difficult,
- The bricks of the language (ie, the type system) make it hard to build designs that are easy to grasp.

Number three relates to how its grandiose type system makes you end up with many types that use parametric polymorphism, and you must go through the hassle of understanding how each parameter is used in each function call and in each function definition. Add typeclasses to that, and understanding all this becomes even harder.

Number two, tracking state, actually stems from Number three. State is designed to work through monads, which are a complex structure that relies on both typeclasses and parametric polymorphism, which means understanding how a specific state type works is made hard.

I don't want to delve too deep into why understanding those things is hard when you read code that was not authored by you, because that requires explaining some example code, which would be difficult precisely for the reason I give, and it would be really frustrating for you reader.

Now, I'll tackle syntax, which is far nicer to poke fun at. The original reason people fear language with significant whitespace is that it is really easy, as a language designer, to get wrong. Python certainly did get it right, but Haskell failed. Let me show you an example of Haskell code that made me struggle to get right:

    expandRow :: Row Choice -> [Row Choice]
    expandRow r = expandRowAcc r []
      where expandRowAcc (x:xs) lead = if (multipleChoice x)
        then -- The pivot is x.
          [lead ++ [[d]] ++ xs | d  [Row Choice]
    expandRow r = expandRowAcc r [] where
      expandRowAcc (x:xs) lead = if (multipleChoice x)
        then -- The pivot is x.
          [lead ++ [[d]] ++ xs | d <- x]
        else -- The pivot is in xs.
          expandRowAcc xs (lead ++ [x])

That is obviously invalid Haskell, right? The where keyword should be at the end of the previous line, like so:

    expandRow :: Row Choice -> [Row Choice]
    expandRow r = expandRowAcc r [] where
      expandRowAcc (x:xs) lead = if (multipleChoice x)
        then -- The pivot is x.
          [lead ++ [[d]] ++ xs | d <- x]
        else -- The pivot is in xs.
          expandRowAcc xs (lead ++ [x])

On the other hand, this is obviously valid Haskell, even though the where is at the start of a line:

    expandRow r = expandRowAcc r []
      where expandRowAcc (x:xs) lead = if (multipleChoice x) then [lead ++ [[d]] ++ xs | d <- x] else expandRowAcc xs (lead ++ [x])

There are many other things that make the syntax awkward, inconsistency such as defining a function normally (optionally with a `case…of`), with a series of clauses, and with guards (each have fundamentally distinct syntax, making the use of two of them impossible in lambda expressions). Some things are made very hard, such as knowing the precedence and therefore when to put a parenthesis. (I end up putting parentheses everywhere, because every time I see an obscure type error, I don’t want to fight with the angst that it might be caused by a precedence error.)

Another example of awkward syntax appears in one of Haskell’s most adorable features, currying. Currying makes the order of the parameters of the function you make matter a lot. You should make it so that the last argument, when removed, makes the curried function be useful. However, using infix notation, the first argument can also be removed for currying. You’re out of luck for all other arguments.

Overall, all of Haskell’s pros make code really easy to write, but its cons make code quite hard to read and maintain. Touching something already authored requires a lot of thought into how every piece fits together, and it can still break things in a way that is both predictable and logical, assuming you know Haskell better than your own mother tongue.

I see Haskell as an amazing project to steer interest in language design, but I am a bigger fan of its offsprings than I am of Haskell itself.
