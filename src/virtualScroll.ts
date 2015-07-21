interface IHash<T> {
    [key: string]: T;
}
interface IScrollHandler {
    (scrollLeft: number, scrollTop: number): void;
}

interface IResizeEvent {
    (): [number, number];
}

function removeItemFromArray(array, item): boolean {
    var index = array.indexOf(item);
    if (index > -1) {
        item.splice(item, 1);
        return true;
    }
    return false;
}

enum Direction {
    x = 1,
    y = 2,
    both = 3
}

export class ScrollBox {
    private disposibles = [];
    private syncScroll: number;
    constructor(public element: HTMLElement) {
    }
    onScroll(callback: Function): Function {
        var updatePosition = () => {
            callback(this.element.scrollLeft, this.element.scrollTop);
        };

        this.element.addEventListener('scroll', updatePosition)
        var disposible = () => {
            removeItemFromArray(this.disposibles, disposible);
            this.element.removeEventListener('scroll', updatePosition);
        };

        this.disposibles.push();
        return disposible;
    }
    syncWith(scrollBox: ScrollBox, direction: Direction) {
        scrollBox.onScroll((scrollLeft: number, scrollTop: number) => {
            /* tslint:disable */
            if (direction & Direction.x) {
                this.element.scrollLeft = scrollLeft;
            }
            if (direction & Direction.y) {
                this.element.scrollTop = scrollTop;
            }
            if (this.syncScroll) {
                clearTimeout(this.syncScroll);
            }
            this.syncScroll = setTimeout(() => {
                this.syncScroll = undefined;
            }, 250);
            /* tslint:enable */
        });
    }

    onSizeChange(callback): Function {
        var respond = (): [number, number] => {
            return [this.element.offsetWidth, this.element.offsetWidth];
        };
        window.addEventListener('resize', respond);
        respond();
        var disposible = () => {
            removeItemFromArray(this.disposibles, disposible);
            this.element.removeEventListener('resize', respond);
        };
        this.disposibles.push(disposible);
        return disposible;
    }

    dispose() {
        this.disposibles.forEach((disposible: Function) => {
            disposible();
        });
    }
}

export class VirtualScroll {
    private currentVerticalLastIndex: number;
    private currentHorizontalLastIndex: number
    private verticalItems: Array<any>;
    private verticalItemPositions: Array<number>;
    private horizontalItems: Array<any>;
    private horizontalItemPositions: Array<number>;
    private disposibles = [];
    private height: number;
    private width: number;
    private scrollTop: number;
    private scrollLeft: number;
    private currentVerticalIndex: number = 0;
    private currentHorizontalIndex: number = 0;
    private scrollArea: HTMLDivElement;
    private verticalStructure: IStructure<any>;
    private horizontalStructure: IStructure<any>;

    constructor(
        private scrollBox: ScrollBox) {
        this.disposibles.push(scrollBox.onSizeChange(this.setVisibleSpace.bind(this)));
        this.disposibles.push(scrollBox.onScroll(this.scroll.bind(this)));
    }

    setVerticalStructure(structure: IStructure<any>) {
        this.verticalStructure = structure;
    }

    setHorizontalStructure(structure: IStructure<any>) {
        this.horizontalStructure = structure;
    }

    setVisibleSpace(height: number, width: number): void {
        this.height = height;
        this.width = width;
    }

    initialize() {

        if (this.verticalStructure) {
            this.getVerticalItems();
        }
        if (this.horizontalStructure) {
            this.getHorizontalItems();
        }
        this.renderVisibleItems();
    }

    scroll(scrollLeft: number, scrollTop: number): void {
        this.scrollTop = scrollTop;
        this.scrollLeft = scrollLeft;
        this.renderVisibleItems();
    }

    private renderVisibleItems() {
        var unusedCell: IHash<Array<IStructureInstance>> = this.getCurrentUnusedCells();
        var cellsToPosition: Array<IStructureInstance> = this.calculateNeededCells(unusedCells);
        this.positionCells(cellsToPosition);
    }

    private updateVerticalIndex(): number {
        var currentVerticalIndex = this.currentVerticalIndex;
        if (this.scrollTop > this.verticalItemPositions[currentVerticalIndex]) {
            while(this.scrollTop >= this.verticalItemPositions[++currentVerticalIndex]) {
                this.currentVerticalIndex = currentVerticalIndex - 1;
            }
        } else if (this.scrollTop < this.verticalItemPositions[currentVerticalIndex]) {
            while(this.scrollTop >= this.verticalItemPositions[--currentVerticalIndex]) {
                this.currentVerticalIndex = currentVerticalIndex + 1;
            }
        }
        return this.currentVerticalIndex;
    }

    private updateVerticalLastIndex(): number {
        var currentVerticalIndex = this.currentVerticalIndex;
        var right = this.scrollLeft + this.width;
        while(right < this.verticalItemPositions[++currentVerticalIndex]) {
            this.currentVerticalLastIndex = currentVerticalIndex + 1;
        }
        return this.currentVerticalLastIndex;
    }

    private updateHorizontalIndex(): number {
        var currentHorizontalIndex = this.currentHorizontalIndex;
        if (this.scrollLeft > this.horizontalItemPositions[currentHorizontalIndex]) {
            while(this.scrollLeft >= this.horizontalItemPositions[++currentHorizontalIndex]) {
                this.currentHorizontalIndex = currentHorizontalIndex - 1;
            }
        } else if (this.scrollLeft < this.horizontalItemPositions[currentHorizontalIndex]) {
            while(this.scrollLeft >= this.horizontalItemPositions[--currentHorizontalIndex]) {
                this.currentHorizontalIndex = currentHorizontalIndex + 1;
            }
        }
        return this.currentHorizontalIndex;
    }

    private updateHorizontalLastIndex(): number {
        var currentHorizontalIndex = this.currentHorizontalIndex;
        var right = this.scrollLeft + this.width;
        while(right < this.horizontalItemPositions[++currentHorizontalIndex]) {
            this.currentHorizontalLastIndex = currentHorizontalIndex + 1;
        }
        return this.currentHorizontalLastIndex;
    }

    private getVerticalItems(previous?) {
        this.verticalItems =  previous ?
            this.verticalStructure.getPreviousItems() :
            this.verticalStructure.getNextItems();
        var nextItemPosition = 0;
        this.verticalItemPositions = this.verticalItems.map((item, index) => {
            var itemPosition = nextItemPosition;
            nextItemPosition += this.verticalStructure.height;
            return itemPosition;
        });

        this.updateScrollArea();
    }

    private getHorizontalItems(previous?) {
        this.horizontalItems = previous ?
            this.horizontalStructure.getPreviousItems() :
            this.horizontalStructure.getNextItems();
        var nextItemPosition = 0;
        this.horizontalItemPositions = this.horizontalItems.map((item, index) => {
            var itemPosition = nextItemPosition;
            nextItemPosition += this.horizontalStructure.width;
            return itemPosition;
        });
        this.updateScrollArea();
    }

    updateScrollArea() {
        if (!this.scrollArea) {
            this.scrollArea = document.createElement('div');
            this.scrollBox.element.appendChild(this.scrollArea);
        }

        if (this.horizontalStructure) {
            this.scrollArea.style.width = (this.verticalItems.length * this.horizontalStructure.width) + 'px';
        } else {
            this.scrollArea.style.width = '100%';
        }

        if (this.verticalStructure) {
            this.scrollArea.style.height = (this.verticalItems.length * this.verticalStructure.height) + 'px';
        } else {
            this.scrollArea.style.height = '100%';
        }
    }

    dispose() {
        this.disposibles.forEach((disposible: Function) => {
            disposible();
        });
    }
}

export interface IStructure<T> {
    height: number;
    width: number;
    structureType: string;

    getNextItems?: <U>(parent?: U) => Array<T>;s
    getPreviousItems?: <U>(parent?: U) => Array<T>;

    hasNextItems?: () => boolean;
    hasPreviousItems?: () => boolean;

    render(data: T): IStructureInstance<T>;
    getChildStructure<U>(): IStructure<U>;
}

interface IStructureInstance<T> extends HTMLElement {
    update(data: T): void;
    structureType: string;
}
