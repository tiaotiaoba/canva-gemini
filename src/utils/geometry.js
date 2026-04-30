// Canvas geometry and DOM utility functions
// Extracted from App.jsx

export const MIN_NODE_WIDTH = 220;
export const MIN_NODE_HEIGHT = 160;

export const clampNumber = (value, min, max) => Math.min(max, Math.max(min, value));

export const clampValue = (value, min, max) => Math.min(Math.max(value, min), max);

export const findScrollableElementWithinBoundary = (startElement, boundaryElement) => {
    let current = startElement instanceof Element ? startElement : null;
    while (current) {
        if (current instanceof HTMLElement) {
            const style = window.getComputedStyle(current);
            const canScrollY = /(auto|scroll|overlay)/.test(style.overflowY) && current.scrollHeight > current.clientHeight + 1;
            const canScrollX = /(auto|scroll|overlay)/.test(style.overflowX) && current.scrollWidth > current.clientWidth + 1;
            if (canScrollY || canScrollX) {
                return current;
            }
        }

        if (!boundaryElement || current === boundaryElement) {
            break;
        }

        current = current.parentElement;
    }

    return null;
};

export const resizeNodeFromDirection = (startNode, direction, deltaX, deltaY) => {
    const next = {
        x: startNode.x,
        y: startNode.y,
        width: startNode.width,
        height: startNode.height
    };

    if (direction.includes('right')) {
        next.width = Math.max(MIN_NODE_WIDTH, startNode.width + deltaX);
    }
    if (direction.includes('left')) {
        const widthFromLeft = Math.max(MIN_NODE_WIDTH, startNode.width - deltaX);
        next.x = startNode.x + (startNode.width - widthFromLeft);
        next.width = widthFromLeft;
    }
    if (direction.includes('bottom')) {
        next.height = Math.max(MIN_NODE_HEIGHT, startNode.height + deltaY);
    }
    if (direction.includes('top')) {
        const heightFromTop = Math.max(MIN_NODE_HEIGHT, startNode.height - deltaY);
        next.y = startNode.y + (startNode.height - heightFromTop);
        next.height = heightFromTop;
    }

    return next;
};
