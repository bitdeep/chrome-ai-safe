# Chrome AI Safe Browser

## 🚀 Elevator Pitch

AI-powered browser extension that intelligently analyzes web content in real-time to protect you from harmful, deceptive, and unsafe content. Your personal safety guardian for a more secure browsing experience.

## 📖 About the project

This project was inspired by my need for a safer internet browsing experience, especially as online threats become more sophisticated. With the rise of AI technology, I saw an opportunity to create a tool that could proactively protect me and my family by analyzing web content in real-time.

### What I learned

-   Working with Chrome Extensions and their architecture
-   Implementing AI content analysis using the Window AI API
-   Breaking down large content into manageable chunks for processing
-   Real-time safety scoring and threat detection
-   Error handling and user feedback mechanisms

### How I built it

The extension was built using:

-   JavaScript for the core functionality
-   Chrome Extensions API for browser integration
-   Window AI API for content analysis
-   Custom scoring algorithm that evaluates multiple safety factors

The extension works by:

1. Capturing webpage content in real-time
2. Breaking content into analyzable chunks
3. Processing each chunk through an AI model
4. Calculating safety scores based on multiple risk factors
5. Providing immediate feedback to users

### Challenges faced

-   Managing large content analysis without impacting browser performance
-   Implementing reliable content chunking for accurate analysis
-   Handling API rate limits and errors gracefully
-   Creating an intuitive user interface for safety notifications
-   Balancing sensitivity of content detection to minimize false positives

The biggest technical challenge was developing an accurate scoring system that could evaluate multiple risk factors while maintaining real-time performance. This required careful optimization of the AI prompts and efficient content processing strategies.

-   Managing large content analysis without impacting browser performance
-   Implementing reliable content chunking for accurate analysis
-   Handling API rate limits and errors gracefully
-   Creating an intuitive user interface for safety notifications

### Built with

-   JavaScript
-   Chrome Extensions API
-   Chrome AI API
