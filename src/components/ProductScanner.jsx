import React, { useEffect, useRef, useState } from "react";
import axios from "axios";
import { BrowserMultiFormatReader } from "@zxing/library";
import "../App.css";
import CurrentTime from "./CurrentTime";

const ProductScanner = () => {
  const scannerRef = useRef(null);
  const videoRef = useRef(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [scanResult, setScanResult] = useState(null);
  const [isCameraAvailable, setIsCameraAvailable] = useState(true);
  const [isCameraActive, setIsCameraActive] = useState(true);
  const [scannedBarcode, setScannedBarcode] = useState("");
  const [lastScannedBarcode, setLastScannedBarcode] = useState("");
  const [lastScanTime, setLastScanTime] = useState(0);
  const [productData, setProductData] = useState({
    barcode: "",
    name: "",
    price: "",
    quantity: 1
  });
  const [cartItems, setCartItems] = useState([]);
  const [isLookingUp, setIsLookingUp] = useState(false);
  const [processingBarcode, setProcessingBarcode] = useState(false);
  const [cameras, setCameras] = useState([]);
  const [activeCameraIndex, setActiveCameraIndex] = useState(0);
  
  const SCAN_COOLDOWN = 3000; // Cooldown period of 3 seconds

  useEffect(() => {
    const savedCart = localStorage.getItem('cartItems');
    if (savedCart) {
      setCartItems(JSON.parse(savedCart));
    }
  }, []);

  useEffect(() => {
    localStorage.setItem('cartItems', JSON.stringify(cartItems));
  }, [cartItems]);

  useEffect(() => {
    const codeReader = new BrowserMultiFormatReader();

    codeReader
      .listVideoInputDevices()
      .then(videoInputDevices => {
        if (videoInputDevices.length === 0) {
          setIsCameraAvailable(false);
          setIsLoading(false);
          throw new Error("No camera devices found");
        }

        setCameras(videoInputDevices);
        startScanner(codeReader, videoInputDevices[activeCameraIndex].deviceId);
      })
      .catch(err => {
        console.error(err);
        setError("Kamera tapılmadı və ya icazə verilmədi.");
        setIsLoading(false);
      });

    return () => {
      codeReader.reset();
    };
  }, [activeCameraIndex]);

  const startScanner = (codeReader, deviceId) => {
    codeReader.decodeFromVideoDevice(deviceId, videoRef.current, (result, error) => {
      if (result && isCameraActive && !processingBarcode) {
        const barcode = result.getText();
        const currentTime = Date.now();
        
        if (barcode !== lastScannedBarcode || (currentTime - lastScanTime) > SCAN_COOLDOWN) {
          setProcessingBarcode(true);
          setScannedBarcode(barcode);
          setLastScannedBarcode(barcode);
          setLastScanTime(currentTime);
          setIsCameraActive(false);
          lookupProductByBarcode(barcode);
        }
      }
    });
  };

  const switchCamera = () => {
    setActiveCameraIndex(prevIndex => (prevIndex + 1) % cameras.length);
  };

  const lookupProductByBarcode = async (barcode) => {
    try {
      setIsLookingUp(true);
      setError(null);

      const response = await axios.get("http://localhost:2000/products");
      if (response.data && Array.isArray(response.data)) {
        const foundProduct = response.data.find(product => product.barcode === barcode);

        if (foundProduct) {
          // Check if product already exists in cart
          const existingItemIndex = cartItems.findIndex(item => item.barcode === foundProduct.barcode);
          
          if (existingItemIndex !== -1) {
            // Update existing item quantity - ALWAYS increment by exactly 1
            const updatedItems = [...cartItems];
            const newQuantity = updatedItems[existingItemIndex].quantity + 1;
            updatedItems[existingItemIndex] = {
              ...updatedItems[existingItemIndex],
              quantity: newQuantity
            };
            setCartItems(updatedItems);
            setScanResult(`${foundProduct.name} sayı artırıldı: ${newQuantity}`);
          } else {
            // Add new product to cart - ALWAYS with quantity 1
            const newItem = {
              id: Date.now(),
              barcode: foundProduct.barcode,
              name: foundProduct.name,
              price: parseFloat(foundProduct.price),
              quantity: 1 // Always start with 1
            };
            setCartItems(prevItems => [...prevItems, newItem]);
            setScanResult(`${foundProduct.name} səbətə əlavə edildi`);
          }
          
          setProductData({
            barcode: foundProduct.barcode,
            name: foundProduct.name,
            price: foundProduct.price.toString(),
            quantity: 1
          });
        } else {
          setProductData({ barcode, name: "", price: "", quantity: 1 });
          setScanResult(`Barkod ${barcode} üçün məhsul tapılmadı.`);
        }
      } else {
        setProductData({ barcode, name: "", price: "", quantity: 1 });
        setScanResult(`Skand edilmiş barkod: ${barcode}`);
      }
    } catch (err) {
      console.error("Məhsul axtarışında xəta:", err);
      setProductData({ barcode, name: "", price: "", quantity: 1 });
      setError(`Xəta baş verdi: ${err.message}`);
    } finally {
      setIsLookingUp(false);
      
      setTimeout(() => {
        setIsCameraActive(true);
        setProcessingBarcode(false); 
      }, SCAN_COOLDOWN); 
    }
  };

  const handleManualBarcodeSubmit = (e) => {
    e.preventDefault();
    const manualBarcode = e.target.elements.manualBarcode.value;
    if (manualBarcode) {
      setProcessingBarcode(true); 
      lookupProductByBarcode(manualBarcode);
      e.target.elements.manualBarcode.value = '';
    }
  };

  const removeFromCart = (itemId) => {
    setCartItems(prevItems => prevItems.filter(item => item.id !== itemId));
  };

  const updateQuantity = (itemId, newQuantity) => {
    if (newQuantity < 1) return;
    
    setCartItems(prevItems => 
      prevItems.map(item => 
        item.id === itemId ? { ...item, quantity: newQuantity } : item
      )
    );
  };

  const clearCart = () => {
    setCartItems([]);
    localStorage.removeItem('cartItems');
  };

  const totalPrice = cartItems.reduce((sum, item) => sum + parseFloat(item.price) * item.quantity, 0).toFixed(2);
  const totalItems = cartItems.reduce((sum, item) => sum + item.quantity, 0);

  return (
    <div className="scanner-container">
      {/* Hidden Camera Section - Still functional but not visible */}
      <div className="hidden-camera-section">
        <div ref={scannerRef} className="camera-container">
          <video ref={videoRef} className="camera-video" />
        </div>
        
        {/* Status Indicator (Hidden but Functional) */}
        <div className="scan-status">
          {isLookingUp && <div className="scanning-indicator">Scanning...</div>}
          {error && <div className="error-indicator">{error}</div>}
        </div>
        
        {/* Camera Switch Button (Hidden but Functional) */}
        {cameras.length > 1 && (
          <button onClick={switchCamera} className="camera-switch-btn">
            Kameranı dəyiş
          </button>
        )}
        
        {/* Manual Barcode Form (Hidden but Functional) */}
        <form onSubmit={handleManualBarcodeSubmit} className="manual-barcode-form">
          <input
            type="text"
            name="manualBarcode"
            placeholder="Barkod nömrəsini daxil edin"
          />
          <button type="submit">Axtar</button>
        </form>
      </div>

      {/* Shopping Cart (Visible) */}
      <div className="cart-container">
        <div className="cart-header">
          <h2>Səbət</h2>
          <div className="header-right">
            <span className="date-time"><CurrentTime /></span>
            {scanResult && <div className="scan-result">{scanResult}</div>}
          </div>
        </div>
        
        {cartItems.length === 0 ? (
          <div className="empty-cart">
            <div className="empty-cart-icon">🛒</div>
            <p>Səbətiniz boşdur</p>
            <p className="empty-cart-hint">Məhsul əlavə etmək üçün barkod oxudun</p>
          </div>
        ) : (
          <div className="cart-content">
            <table className="cart-table">
              <thead>
                <tr>
                  <th className="barcode-column">Barkod</th>
                  <th className="name-column">Məhsulun Adı</th>
                  <th className="price-column">Qiymət</th>
                  <th className="quantity-column">Sayı</th>
                  <th className="total-column">Cəmi</th>
                  <th className="action-column"></th>
                </tr>
              </thead>
              <tbody>
                {cartItems.map((item) => (
                  <tr key={item.id} className="cart-item">
                    <td className="barcode-column">{item.barcode}</td>
                    <td className="name-column">{item.name}</td>
                    <td className="price-column">{parseFloat(item.price).toFixed(2)} ₼</td>
                    <td className="quantity-column">
                      <div className="quantity-controls">
                        <button 
                          type="button" 
                          className="quantity-btn dec" 
                          onClick={() => updateQuantity(item.id, item.quantity - 1)}
                          disabled={item.quantity <= 1}
                        >
                          -
                        </button>
                        <span className="quantity-value">{item.quantity}</span>
                        <button 
                          type="button" 
                          className="quantity-btn inc" 
                          onClick={() => updateQuantity(item.id, item.quantity + 1)}
                        >
                          +
                        </button>
                      </div>
                    </td>
                    <td className="total-column">
                      {(parseFloat(item.price) * item.quantity).toFixed(2)} ₼
                    </td>
                    <td className="action-column">
                      <button
                        onClick={() => removeFromCart(item.id)}
                        className="remove-btn"
                        aria-label="Remove item"
                      >
                        ✕
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            <div className="cart-footer">
              <div className="cart-summary">
                <div className="cart-count">
                  <span className="summary-label">Ümumi məhsul:</span>
                  <span className="summary-value">{totalItems}</span>
                </div>
                <div className="cart-total">
                  <span className="summary-label">Ümumi məbləğ:</span>
                  <span className="summary-value">{totalPrice} ₼</span>
                </div>
              </div>
              
              <div className="cart-actions">
                <button
                  onClick={clearCart}
                  className="clear-cart-btn"
                >
                  Səbəti Təmizlə
                </button>
                <button
                  onClick={() => {
                    alert(`Sifariş tamamlandı: ${totalItems} məhsul, ${totalPrice} ₼`);
                    clearCart();
                  }}
                  className="checkout-btn"
                >
                  Sifarişi Tamamla
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ProductScanner;