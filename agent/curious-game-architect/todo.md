# Curious Game Architect - TODO

## Core Architecture
- [ ] Define GameSpec type with all required fields (genre, mechanics, visuals, audience, story, progression, special_features)
- [ ] Create interview question flow and state management
- [ ] Implement prompt builder that compiles GameSpec into OpenSmolGame prompt with technical requirements

## Backend (tRPC)
- [ ] Create tRPC procedure for LLM invocation (generateGame)
- [ ] Create tRPC procedure for GameSpec management (saveGameSpec, getGameSpec)
- [ ] Implement prompt assembly logic with all technical constraints

## Frontend UI
- [ ] Build chat interface component for AI interviewer
- [ ] Implement message streaming from LLM
- [ ] Create progress indicator showing collected GameSpec fields
- [ ] Add user input handling and message parsing

## Game Preview & Export
- [ ] Create sandboxed iframe component for game preview
- [ ] Implement HTML export functionality
- [ ] Add download button for standalone HTML file

## Testing & Refinement
- [ ] Test full interview flow
- [ ] Verify prompt generation with technical requirements
- [ ] Test LLM API invocation and game generation
- [ ] Verify iframe sandbox isolation
- [ ] Test export functionality

## Completed
