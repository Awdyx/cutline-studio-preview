import { TransformComponent, TransformWrapper } from 'react-zoom-pan-pinch'

const CANVAS_SIZE = 8000

function App() {
  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        width: '100vw',
        height: '100vh',
        overflow: 'hidden',
      }}
    >
      <TransformWrapper
        initialScale={1}
        minScale={0.4}
        maxScale={4}
        limitToBounds={false}
        disablePadding
        centerZoomedOut={false}
        onInit={(ref) => ref.centerView()}
        wheel={{
          step: 0.02,
          activationKeys: (keys) =>
            keys.includes('Control') || keys.includes('Meta'),
        }}
        trackPadPanning={{ disabled: false }}
        panning={{ velocityDisabled: false }}
        velocityAnimation={{
          sensitivityMouse: 0.4,
          sensitivityTouch: 0.4,
          animationTime: 350,
          animationType: 'easeOut',
        }}
        doubleClick={{ disabled: true }}
      >
        <TransformComponent
          wrapperStyle={{
            width: '100%',
            height: '100%',
            touchAction: 'none',
          }}
          contentStyle={{ willChange: 'transform' }}
        >
          <div
            style={{
              width: CANVAS_SIZE,
              height: CANVAS_SIZE,
              backgroundColor: '#fafafa',
              backgroundImage:
                'radial-gradient(circle, rgba(0, 0, 0, 0.12) 1px, transparent 1px)',
              backgroundSize: '24px 24px',
            }}
            onPointerDown={(event) => {
              console.log(event.pointerType)
            }}
          />
        </TransformComponent>
      </TransformWrapper>
    </div>
  )
}

export default App
