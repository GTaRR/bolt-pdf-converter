(function () {
    document.addEventListener('DOMContentLoaded', function () {

        // Polyfill for ie11
        Math.sign = Math.sign || function(x) {
            x = +x; // преобразуем в число
            if (x === 0 || isNaN(x)) {
                return x;
            }
            return x > 0 ? 1 : -1;
        }

        class zoomReader {
            constructor(options) {
                this.container = document.querySelector(options.container);
                this.viewport = document.querySelector(options.viewport);
                this.slides = document.querySelectorAll(options.slides);
                this.prevBtn = document.querySelector(options.prev);
                this.nextBtn = document.querySelector(options.next);
                this.numPage = document.querySelector(options.numPage);
                this.pageCount = document.querySelector(options.pageCount);
                this.plus = document.querySelector(options.plus);
                this.minus = document.querySelector(options.minus);
                this.renderer = options.renderer;
                this.scaleSlider = null;

                this.count = this.slides.length;
                this.pageCount.innerHTML = this.count;
                this.index = 0;
                this.currentPage = this.slides[0];
                this.currentImage = this.currentPage.querySelector('img');
                this.originalSize = {};
                this.percentContain = 100;

                this.scale = 1;

                this.init();
            }

            init() {
                this.currentPage.classList.add('active');
                this.prevBtn.disabled = true;

                this.prevBtn.addEventListener('click', () => { this.prevPage(); });
                this.nextBtn.addEventListener('click', () => { this.nextPage(); });

                this.plus.addEventListener('click', () => {
                    if (this.scale + .2 <= this.renderer.maxScale) {
                        this.scale += .2;
                    } else {
                        this.scale = this.renderer.maxScale;
                    }
                    this.renderer.scale(this.scale);
                    this.scaleSlider.set(this.scale * this.percentContain);
                });
                this.minus.addEventListener('click', () => {
                    if (this.scale - .2 >= 1) {
                        this.scale -= .2;
                    } else {
                        this.scale = 1;
                    }
                    this.renderer.scale(this.scale);
                    this.scaleSlider.set(this.scale * this.percentContain);
                });

                setTimeout(() => {
                    this.setImagesSize();
                }, 0);

                this.renderer.setElement(this.currentPage);
                this.renderer.on('zoom', (scale) => { this.setScale(scale); });
            }

            createSlider() {
                this.percentContain = Math.max(
                    this.currentImage.height,
                    this.currentImage.width
                ) / Math.max(
                    this.originalSize.height,
                    this.originalSize.width
                ) * 100;

                const scaleSlider = document.querySelector('.b-pdf-carousel-scale-track');
                noUiSlider.create(scaleSlider, {
                    start: '0',
                    range: {
                        'min': [this.percentContain],
                        // '30%': [50],
                        // '70%': [100],
                        'max': [this.percentContain * 5]
                    },
                    // pips: {
                    //     mode: 'range',
                    //     density: 4
                    // }
                });

                this.scaleSlider = scaleSlider.noUiSlider;
            }

            setScale(scale) {
                this.scale = scale;
                this.scaleSlider.set(scale * this.percentContain);
            }

            updateSlider() {
                this.scale = this.scaleSlider.get() / this.percentContain;
                this.renderer.scale(this.scale);
            }

            setImagesSize() {
                let height = this.viewport.clientHeight;

                for (let i = 0; i < this.slides.length; i++) {
                    let slide = this.slides[i];
                    slide.getElementsByTagName('img')[0].style.height = height+'px';
                }

                let originalImage = new Image();
                originalImage.onload = () => {
                    this.originalSize = {
                        width: originalImage.width,
                        height: originalImage.height
                    }

                    this.createSlider();
                    this.scaleSlider.on('slide', () => { this.updateSlider(); });
                }
                originalImage.src = this.currentImage.src;
            }

            prevPage() {
                if (this.index <= 0) return;
                this.changePage(--this.index);
            }

            nextPage() {
                if (this.index >= this.count - 1) return;
                this.changePage(++this.index);
            }

            changePage(index) {
                this.index = index;
                const slide = this.slides[index];
                this.currentPage = slide;
                this.numPage.innerHTML = this.index + 1;

                for (let i = 0; i < this.slides.length; i++) {
                    let slide = this.slides[i];
                    slide.classList.remove('active');
                }

                slide.classList.add('active');

                this.prevBtn.disabled = index === 0;
                this.nextBtn.disabled = index === this.count - 1;

                this.scaleSlider.set(this.percentContain);

                this.renderer.panTo({
                    originX: 0,
                    originY: 0,
                    scale: 1,
                });
                this.renderer.setElement(slide);
            }
        }

        class zoomPanRenderer {
            constructor({ minScale, maxScale, element, scaleSensitivity = 10 }) {
                this.element = element;
                this.viewport = viewport;
                this.minScale = minScale;
                this.maxScale = maxScale;
                this.scaleSensitivity = scaleSensitivity;
                this.transformation = {
                    originX: 0,
                    originY: 0,
                    prevX: 0,
                    prevY: 0,
                    translateX: 0,
                    translateY: 0,
                    scale: 1
                };
                this._triggers = {};
                this.isIE11 = !!window.MSInputMethodContext && !!document.documentMode;
                this.isTouch = ('ontouchstart' in window);
            }

            hasPositionChanged({ pos, prevPos }) {
                return pos !== prevPos;
            }

            valueInRange({ minScale, maxScale, scale }) {
                return scale <= maxScale && scale >= minScale;
            }

            getTranslate({ minScale, maxScale, scale }) {
                return ({ pos, prevPos, translate }) =>
                    this.valueInRange({ minScale, maxScale, scale }) && this.hasPositionChanged({ pos, prevPos })
                        ? translate + (pos - prevPos * scale) * (1 - 1 / scale)
                        : translate;
            }

            getMatrix({ scale, translateX, translateY }) {
                return `matrix(${scale}, 0, 0, ${scale}, ${translateX}, ${translateY})`;
            }

            getScale({ scale, minScale, maxScale, scaleSensitivity, deltaScale }) {
                let newScale = scale + (deltaScale / (scaleSensitivity / scale));
                newScale = Math.max(minScale, Math.min(newScale, maxScale));
                return [scale, newScale];
            }


            setElement( element ) {
                this.element = element
            }

            on( event, callback ) {
                if(!this._triggers[event])
                    this._triggers[event] = [];
                this._triggers[event].push( callback );
            }

            resetPrev() {
                this.transformation.prevX = 0;
                this.transformation.prevY = 0;
            }

            pan({ originX, originY }) {
                const imgDimension = this.element.querySelector('img').getBoundingClientRect();
                const viewportDimension = this.viewport.getBoundingClientRect();
                const isImgWider = imgDimension.width >= viewportDimension.width;
                const isImgHigher = imgDimension.height >= viewportDimension.height;

                if ( (imgDimension.right >= viewportDimension.right && originX < 0)
                    || ((imgDimension.left + originX >= viewportDimension.left)
                        && (originX < 0))
                ) {
                    this.transformation.translateX += originX;
                } else if ( (imgDimension.left <= viewportDimension.left && originX > 0)
                    || ((imgDimension.right + originX <= viewportDimension.right)
                        && (originX > 0))
                ) {
                    this.transformation.translateX += originX;
                } else if (this.isIE11) {
                    this.transformation.translateX += originX;
                }

                if ( (imgDimension.top + originY <= viewportDimension.top)
                    && (originY > 0)
                ) {
                    this.transformation.translateY += originY;
                } else if ( (imgDimension.bottom + originY >= viewportDimension.bottom)
                    && (originY < 0)
                ) {
                    this.transformation.translateY += originY;
                } else if (this.isIE11) {
                    this.transformation.translateY += originY;
                }

                if (!isImgWider) {
                    this.transformation.translateX = 0;
                }

                if (!isImgHigher) {
                    this.transformation.translateY = 0;
                }

                this.element.style.transform = this.getMatrix({
                    scale: this.transformation.scale,
                    translateX: this.transformation.translateX,
                    translateY: this.transformation.translateY
                });

                this.triggerHandler('pan');
            }

            panBy({ originX, originY }) {
                if (this.isIE11 || this.isTouch) {
                    const movementX = (this.transformation.prevX ? originX - this.transformation.prevX : 0);
                    const movementY = (this.transformation.prevY ? originY - this.transformation.prevY : 0);
                    this.transformation.prevX = originX;
                    this.transformation.prevY = originY;

                    this.pan({ originX: movementX, originY: movementY });
                } else {
                    this.pan({ originX, originY });
                }
            }

            panTo({ originX, originY, scale }) {
                if (this.isIE11 || this.isTouch) {
                    const movementX = (this.transformation.prevX ? originX - this.transformation.prevX : 0);
                    const movementY = (this.transformation.prevY ? originY - this.transformation.prevY : 0);
                    this.transformation.prevX = originX;
                    this.transformation.prevY = originY;

                    this.transformation.scale = scale;
                    this.pan({ originX: movementX, originY: movementY });
                } else {
                    this.transformation.scale = scale;
                    this.pan({ originX, originY });
                }
            }

            zoom({ x, y, deltaScale }) {
                const { left, top } = this.element.getBoundingClientRect();
                const { minScale, maxScale, scaleSensitivity } = this;
                const [scale, newScale] = this.getScale({ scale: this.transformation.scale, deltaScale, minScale, maxScale, scaleSensitivity });
                const originX = x - left;
                const originY = y - top;
                const newOriginX = originX / scale;
                const newOriginY = originY / scale;
                const translate = this.getTranslate({ scale, minScale, maxScale });
                const translateX = translate({ pos: originX, prevPos: this.transformation.originX, translate: this.transformation.translateX });
                const translateY = translate({ pos: originY, prevPos: this.transformation.originY, translate: this.transformation.translateY });

                this.element.style.transformOrigin = `${newOriginX}px ${newOriginY}px`;

                this.element.style.transform = this.getMatrix({
                    scale: newScale,
                    translateX,
                    translateY
                });

                this.transformation = { originX: newOriginX, originY: newOriginY, translateX, translateY, scale: newScale };

                this.triggerHandler('zoom', this.transformation.scale);
            }

            scale(scale) {
                this.transformation.scale = scale;
                this.pan({ originX: 0, originY: 0 });
                this.triggerHandler('scale', this.transformation.scale);
            }

            triggerHandler(event,params) {
                if (this._triggers[event])
                    for (let i in this._triggers[event])
                        this._triggers[event][i](params);
            }
        }

        let isMouseDown = false;
        const viewport = document.querySelector(".b-pdf-carousel-viewport");
        const instance = new zoomPanRenderer({
            scaleSensitivity: 10,
            minScale: 1,
            maxScale: 5,
            element: viewport.querySelector('.b-pdf-carousel-slide'),
            viewport: viewport
        });

        const onWheel = (event) => {
            event.preventDefault();
            instance.zoom({
                deltaScale: Math.sign(event.deltaY) > 0 ? -1 : 1,
                x: event.pageX,
                y: event.pageY
            });
        }
        const onMouseDown = (event) => {
            if (event.which === 1 || ("ontouchstart" in window)) {
                isMouseDown = true;
            }
            viewport.classList.add('grab');
        };
        const onMouseEnd = (event) => {
            isMouseDown = false;
            viewport.classList.remove('grab');
            instance.resetPrev();
        };
        const onMouseMove = (event) => {
            if (!isMouseDown) {
                return;
            }
            event.preventDefault();
            // if is IE11
            if(!!window.MSInputMethodContext && !!document.documentMode) {
                instance.panBy({
                    originX: event.screenX,
                    originY: event.screenY
                });
            // if is touch device
            } else if ("ontouchstart" in window) {
                const touchObj = event.changedTouches[0];
                instance.panBy({
                    originX: touchObj.screenX,
                    originY: touchObj.screenY
                });
            } else {
                instance.panBy({
                    originX: event.movementX,
                    originY: event.movementY
                });
            }
        };

        viewport.addEventListener("wheel", onWheel);
        if ("ontouchstart" in window) {
            document.addEventListener('touchstart', onMouseDown);
            document.addEventListener('touchend', onMouseEnd);
            viewport.addEventListener("touchmove", onMouseMove);
        } else {
            document.addEventListener('mousedown', onMouseDown);
            document.addEventListener('mouseup', onMouseEnd);
            viewport.addEventListener("mousemove", onMouseMove);
        }

        const reader = new zoomReader({
            container: '.b-pdf-carousel-main',
            viewport: '.b-pdf-carousel-viewport',
            slides: '.b-pdf-carousel-slide',
            prev: '.b-pdf-carousel-prev',
            next: '.b-pdf-carousel-next',
            numPage: '#page_num',
            pageCount: '#page_count',
            scaleTrack: '.b-pdf-carousel-scale-track',
            plus: '.b-pdf-carousel-scale-track-plus',
            minus: '.b-pdf-carousel-scale-track-minus',
            renderer: instance,
        });
    });
})();