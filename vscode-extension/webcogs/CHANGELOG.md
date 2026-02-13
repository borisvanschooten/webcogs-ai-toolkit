# Change Log

## 0.3.0

Initial extension release

## 0.3.1

Documentation improvements

## 0.3.2

- error emission is triggered faster
- updated version reporting in generated code
- build finished information message

## 0.4.0

- added support for buildcog / promptbuildfiles

## 0.4.1

- cleanup

## 0.5.0

- bumped GPT version to 5.2, minor prompt adaptations. Note: gpt-5.3 is not available through the API yet. 
- some error reporting through info messages
- new directive @cogs_ref for referring to previous function specifications in the same file
- Bugfixes: error when @cogs_endfunc comment directly followed @cogs_func comment; codelens build would include targets with similar names
