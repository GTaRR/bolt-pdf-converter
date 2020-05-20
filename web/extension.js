(function () {
    document.addEventListener('DOMContentLoaded', function () {

        class zoomReader {
            constructor(options) {
                this.container = document.querySelector(options.container);
                this.viewport = document.querySelector(options.viewport);
                this.slides = document.querySelectorAll(options.slides);
                this.prevBtn = document.querySelector(options.prev);
                this.nextBtn = document.querySelector(options.next);
                this.numPage = document.querySelector(options.numPage);
                this.pageCount = document.querySelector(options.pageCount);
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
                        '30%': [50],
                        '70%': [100],
                        'max': [this.percentContain * 5]
                    },
                    pips: {
                        mode: 'range',
                        density: 4
                    }
                });

                this.scaleSlider = scaleSlider.noUiSlider;
            }

            setScale(state) {
                let scale = state.transformation.scale;
                this.scale = scale;
                this.scaleSlider.set(scale * this.percentContain);
            }

            updateSlider() {
                const scale = this.scaleSlider.get() / this.percentContain;
                this.renderer.scale(scale);
            }

            setImagesSize() {
                let height = this.viewport.clientHeight;
                this.slides.forEach((slide)=>{
                    slide.querySelector('img').style.height = height+'px';
                });

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

                this.slides.forEach(function (elem) {
                    elem.classList.remove('active');
                })

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

        const hasPositionChanged = ({ pos, prevPos }) => pos !== prevPos;

        const valueInRange = ({ minScale, maxScale, scale }) => scale <= maxScale && scale >= minScale;

        const getTranslate = ({ minScale, maxScale, scale }) => ({ pos, prevPos, translate }) =>
            valueInRange({ minScale, maxScale, scale }) && hasPositionChanged({ pos, prevPos })
                ? translate + (pos - prevPos * scale) * (1 - 1 / scale)
                : translate;

        const getMatrix = ({ scale, translateX, translateY }) => `matrix(${scale}, 0, 0, ${scale}, ${translateX}, ${translateY})`;

        const getScale = ({ scale, minScale, maxScale, scaleSensitivity, deltaScale }) => {
            let newScale = scale + (deltaScale / (scaleSensitivity / scale));
            newScale = Math.max(minScale, Math.min(newScale, maxScale));
            return [scale, newScale];
        };

        const pan = ({ state, originX, originY }) => {

            const imgDimension = state.element.querySelector('img').getBoundingClientRect();
            const viewportDimension = state.viewport.getBoundingClientRect();
            const isImgWider = imgDimension.width >= viewportDimension.width;
            const isImgHigher = imgDimension.height >= viewportDimension.height;

            if ( (imgDimension.right >= viewportDimension.right && originX < 0)
                || ((imgDimension.left + originX >= viewportDimension.left)
                && (originX < 0))
            ) {
                state.transformation.translateX += originX;
            } else if ( (imgDimension.left <= viewportDimension.left && originX > 0)
                || ((imgDimension.right + originX <= viewportDimension.right)
                && (originX > 0))
            ) {
                state.transformation.translateX += originX;
            }

            if ( (imgDimension.top + originY <= viewportDimension.top)
                && (originY > 0)
            ) {
                state.transformation.translateY += originY;
            } else if ( (imgDimension.bottom + originY >= viewportDimension.bottom)
                && (originY < 0)
            ) {
                state.transformation.translateY += originY;
            }

            if (!isImgWider) {
                state.transformation.translateX = 0;
            }

            if (!isImgHigher) {
                state.transformation.translateY = 0;
            }

            state.element.style.transform = getMatrix({
                scale: state.transformation.scale,
                translateX: state.transformation.translateX,
                translateY: state.transformation.translateY
            });

            state.triggerHandler('pan');
        };

        const canSetElement = (state) => ({
            setElement: (element) => {state.element = element}
        });

        const canSetEventListener = (state) => ({
            on: (event,callback) => {
                if(!state._triggers[event])
                    state._triggers[event] = [];
                state._triggers[event].push( callback );
            },
        });

        const canGetState = (state) => ({
            getState: () => state,
        });

        const canPan = (state) => ({
            panBy: ({ originX, originY }) => pan({ state, originX, originY }),
            panTo: ({ originX, originY, scale }) => {
                state.transformation.scale = scale;
                pan({ state, originX: originX - state.transformation.translateX, originY: originY - state.transformation.translateY });
            },
        });

        const canZoom = (state) => ({
            zoom: ({ x, y, deltaScale }) => {
                const { left, top } = state.element.getBoundingClientRect();
                const { minScale, maxScale, scaleSensitivity } = state;
                const [scale, newScale] = getScale({ scale: state.transformation.scale, deltaScale, minScale, maxScale, scaleSensitivity });
                const originX = x - left;
                const originY = y - top;
                const newOriginX = originX / scale;
                const newOriginY = originY / scale;
                const translate = getTranslate({ scale, minScale, maxScale });
                const translateX = translate({ pos: originX, prevPos: state.transformation.originX, translate: state.transformation.translateX });
                const translateY = translate({ pos: originY, prevPos: state.transformation.originY, translate: state.transformation.translateY });

                state.element.style.transformOrigin = `${newOriginX}px ${newOriginY}px`;
                state.element.style.transform = getMatrix({ scale: newScale, translateX, translateY });
                state.transformation = { originX: newOriginX, originY: newOriginY, translateX, translateY, scale: newScale };

                state.triggerHandler('zoom', state);
            },
            scale: (scale) => {
                state.transformation.scale = scale;
                pan({ state, originX: 0, originY: 0 });
            }
        });

        const renderer = ({ minScale, maxScale, element, scaleSensitivity = 10 }) => {
            const state = {
                element,
                viewport,
                minScale,
                maxScale,
                scaleSensitivity,
                transformation: {
                    originX: 0,
                    originY: 0,
                    translateX: 0,
                    translateY: 0,
                    scale: 1
                },
                _triggers: {},
                triggerHandler: (event,params) => {
                    if( state._triggers[event] ) {
                        for(let i in state._triggers[event] )
                            state._triggers[event][i](params);
                    }
                },
            };
            return Object.assign(
                {},
                canZoom(state),
                canPan(state),
                canSetElement(state),
                canSetEventListener(state),
                canGetState(state)
            );
        };

        let isMouseDown = false;
        const container = document.querySelector(".b-pdf-carousel");
        const viewport = document.querySelector(".b-pdf-carousel-viewport");
        const instance = renderer({
            scaleSensitivity: 10,
            minScale: 1,
            maxScale: 5,
            element: container.querySelector('.b-pdf-carousel-slide'),
            viewport: viewport
        });
        viewport.addEventListener("wheel", (event) => {
            event.preventDefault();
            instance.zoom({
                deltaScale: Math.sign(event.deltaY) > 0 ? -1 : 1,
                x: event.pageX,
                y: event.pageY
            });
        });
        document.addEventListener('mousedown', (event) => {
            if (event.which === 1) {
                isMouseDown = true;
            }
            viewport.classList.add('grab');
        });
        document.addEventListener('mouseup', (event) => {
            isMouseDown = false;
            viewport.classList.remove('grab');
        });
        container.addEventListener("mousemove", (event) => {
            if (!isMouseDown) {
                return;
            }
            event.preventDefault();
            instance.panBy({
                originX: event.movementX,
                originY: event.movementY
            });
        })

        const reader = new zoomReader({
            container: '.b-pdf-carousel-main',
            viewport: '.b-pdf-carousel-viewport',
            slides: '.b-pdf-carousel-slide',
            prev: '.b-pdf-carousel-prev',
            next: '.b-pdf-carousel-next',
            numPage: '#page_num',
            pageCount: '#page_count',
            scaleTrack: '.b-pdf-carousel-scale-track',
            renderer: instance,
        });
    });
})();