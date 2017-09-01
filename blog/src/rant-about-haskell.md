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
          [lead ++ [[d]] ++ xs | d
