# plan.md

\## Figma Reference

https://www.figma.com/proto/DRbvmavnOVkDcRxZCdGN8I/PunchBook?node-id=12-397\&t=pHGf2o5eD7UDK1RV-1



This Figma prototype is the primary reference for:

\- Layout

\- Visual design

\- Component structure

\- Interaction intent (where visible)



Follow it closely when implementing UI.

## App Overview

A mobile-first web app for journaling using stamped images and flowing text. The experience mimics a scrapbook with a playful, tactile feel.

## Core Features

### Feed (Mail System)

* Each item = one journal entry
* Swipe left/right to navigate (rolodex style)
* Infinite loop within the same day
* Feed resets daily (UI assumption)

### Interaction

* Tap → opens modal
* Modal has faded background
* Opening animation: flip/unfold paper

### Create (Editor)

#### Layout

* Text-first layout (journal style)
* Images embedded within text
* Text wraps around images (preferred)

#### Tools

* Add image (stamp)
* Add/edit text
* Delete elements
* Undo/redo

#### Image System

* Upload image
* Clip into custom jagged “stamp” shape (from Figma)

#### Image Interactions

* Drag
* Resize
* Rotate
* Layer multiple images

### Profile

* Public profile
* Displays past entries

### Weekly Summary

* Collage of selected stamps

### Social Page

* Displays public entries

## Navigation

* Feed, Create, Profile
* Sidebar: desktop visible, mobile toggle

## Animations

* Smooth, playful
* 200–400ms
* Slide transitions, flip modal, button feedback

## Gestures

* Swipe (feed)
* Drag (images)

## States

* Loading, error, success

## UI Style

* Scrapbook / textured / playful

## Responsiveness

* Mobile-first, desktop expanded

## Technical Constraints

* Raspberry Pi friendly
* Lightweight frameworks preferred

## Data

* Mock data only
* Prepare for Snowflake

## AI Feature

* “Summarize My Day” button (UI only)

## Auth

* Login + Signup UI only

## Notes

* Infer missing UX where needed
* Prioritize performance

