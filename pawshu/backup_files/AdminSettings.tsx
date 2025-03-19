import { useState } from 'react';
import { 
  CogIcon, 
  BellIcon, 
  ShieldCheckIcon, 
  CurrencyDollarIcon,
  GlobeAltIcon,
  EnvelopeIcon
} from '@heroicons/react/24/outline';
import type { ComponentType, SVGProps } from 'react';

type IconComponent = ComponentType<SVGProps<SVGSVGElement>>;
const CogIconComponent = CogIcon as IconComponent;
const BellIconComponent = BellIcon as IconComponent;
const ShieldCheckIconComponent = ShieldCheckIcon as IconComponent;
const CurrencyDollarIconComponent = CurrencyDollarIcon as IconComponent;
const GlobeAltIconComponent = GlobeAltIcon as IconComponent;
const EnvelopeIconComponent = EnvelopeIcon as IconComponent;

interface SettingsSectionProps {
  title: string;
  icon: React.ReactNode;
  children: React.ReactNode;
}

const SettingsSection = ({ title, icon, children }: SettingsSectionProps) => (
  <div className="bg-white rounded-lg shadow-md p-6 mb-6">
    <div className="flex items-center mb-4">
      <div className="p-2 bg-blue-100 rounded-md mr-3">
        {icon}
      </div>
      <h2 className="text-lg font-semibold">{title}</h2>
    </div>
    <div className="space-y-4">
      {children}
    </div>
  </div>
);

interface ToggleSettingProps {
  id: string;
  label: string;
  description?: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}

const ToggleSetting = ({ id, label, description, checked, onChange }: ToggleSettingProps) => (
  <div className="flex items-center justify-between">
    <div>
      <label htmlFor={id} className="font-medium text-gray-700">{label}</label>
      {description && <p className="text-sm text-gray-500">{description}</p>}
    </div>
    <div className="relative inline-block w-12 h-6 transition duration-200 ease-in-out rounded-full">
      <input
        type="checkbox"
        id={id}
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="absolute w-0 h-0 opacity-0"
      />
      <label
        htmlFor={id}
        className={`absolute inset-0 cursor-pointer rounded-full transition-colors duration-200 ease-in-out ${
          checked ? 'bg-blue-600' : 'bg-gray-300'
        }`}
      >
        <span
          className={`absolute left-0 top-0 h-6 w-6 transform rounded-full bg-white shadow transition-transform duration-200 ease-in-out ${
            checked ? 'translate-x-6' : 'translate-x-0'
          }`}
        />
      </label>
    </div>
  </div>
);

interface InputSettingProps {
  id: string;
  label: string;
  type?: string;
  value: string;
  onChange: (value: string) => void;
}

const InputSetting = ({ id, label, type = 'text', value, onChange }: InputSettingProps) => (
  <div>
    <label htmlFor={id} className="block font-medium text-gray-700">{label}</label>
    <input
      type={type}
      id={id}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
    />
  </div>
);

const AdminSettings = () => {
  // General Settings
  const [storeName, setStoreName] = useState('Pawshu Pet Store');
  const [storeEmail, setStoreEmail] = useState('contact@pawshu.com');
  const [storePhone, setStorePhone] = useState('(123) 456-7890');
  const [storeAddress, setStoreAddress] = useState('123 Pet Street, Animalville, PA 12345');
  
  // Notification Settings
  const [emailNotifications, setEmailNotifications] = useState(true);
  const [orderNotifications, setOrderNotifications] = useState(true);
  const [stockAlerts, setStockAlerts] = useState(true);
  
  // Security Settings
  const [twoFactorAuth, setTwoFactorAuth] = useState(false);
  const [passwordExpiry, setPasswordExpiry] = useState(false);
  const [loginAttempts, setLoginAttempts] = useState('3');
  
  // Payment Settings
  const [currency, setCurrency] = useState('USD');
  const [taxRate, setTaxRate] = useState('10');
  const [paymentMethods, setPaymentMethods] = useState({
    creditCard: true,
    paypal: true,
    applePay: false,
    googlePay: false
  });
  
  // Regional Settings
  const [timezone, setTimezone] = useState('America/New_York');
  const [dateFormat, setDateFormat] = useState('MM/DD/YYYY');
  const [language, setLanguage] = useState('en-US');

  const handlePaymentMethodChange = (method: keyof typeof paymentMethods, checked: boolean) => {
    setPaymentMethods(prev => ({
      ...prev,
      [method]: checked
    }));
  };

  const handleSaveSettings = () => {
    // In a real app, this would save settings to the backend
    alert('Settings saved successfully!');
  };

  return (
    <div>
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-2xl font-bold">Settings</h1>
        <button
          onClick={handleSaveSettings}
          className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
        >
          Save Changes
        </button>
      </div>

      <SettingsSection 
        title="General Settings" 
        icon={<CogIconComponent className="h-6 w-6 text-blue-600" />}
      >
        <InputSetting
          id="storeName"
          label="Store Name"
          value={storeName}
          onChange={setStoreName}
        />
        <InputSetting
          id="storeEmail"
          label="Store Email"
          type="email"
          value={storeEmail}
          onChange={setStoreEmail}
        />
        <InputSetting
          id="storePhone"
          label="Store Phone"
          value={storePhone}
          onChange={setStorePhone}
        />
        <div>
          <label htmlFor="storeAddress" className="block font-medium text-gray-700">Store Address</label>
          <textarea
            id="storeAddress"
            value={storeAddress}
            onChange={(e) => setStoreAddress(e.target.value)}
            rows={3}
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
          />
        </div>
      </SettingsSection>

      <SettingsSection 
        title="Notification Settings" 
        icon={<BellIconComponent className="h-6 w-6 text-blue-600" />}
      >
        <ToggleSetting
          id="emailNotifications"
          label="Email Notifications"
          description="Receive email notifications for important events"
          checked={emailNotifications}
          onChange={setEmailNotifications}
        />
        <ToggleSetting
          id="orderNotifications"
          label="Order Notifications"
          description="Get notified when new orders are placed"
          checked={orderNotifications}
          onChange={setOrderNotifications}
        />
        <ToggleSetting
          id="stockAlerts"
          label="Low Stock Alerts"
          description="Receive alerts when product stock is low"
          checked={stockAlerts}
          onChange={setStockAlerts}
        />
      </SettingsSection>

      <SettingsSection 
        title="Security Settings" 
        icon={<ShieldCheckIconComponent className="h-6 w-6 text-blue-600" />}
      >
        <ToggleSetting
          id="twoFactorAuth"
          label="Two-Factor Authentication"
          description="Require a verification code in addition to password"
          checked={twoFactorAuth}
          onChange={setTwoFactorAuth}
        />
        <ToggleSetting
          id="passwordExpiry"
          label="Password Expiry"
          description="Require password change every 90 days"
          checked={passwordExpiry}
          onChange={setPasswordExpiry}
        />
        <InputSetting
          id="loginAttempts"
          label="Max Login Attempts"
          type="number"
          value={loginAttempts}
          onChange={setLoginAttempts}
        />
      </SettingsSection>

      <SettingsSection 
        title="Payment Settings" 
        icon={<CurrencyDollarIconComponent className="h-6 w-6 text-blue-600" />}
      >
        <div>
          <label htmlFor="currency" className="block font-medium text-gray-700">Currency</label>
          <select
            id="currency"
            value={currency}
            onChange={(e) => setCurrency(e.target.value)}
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
          >
            <option value="USD">USD - US Dollar</option>
            <option value="EUR">EUR - Euro</option>
            <option value="GBP">GBP - British Pound</option>
            <option value="CAD">CAD - Canadian Dollar</option>
            <option value="AUD">AUD - Australian Dollar</option>
          </select>
        </div>
        <InputSetting
          id="taxRate"
          label="Tax Rate (%)"
          type="number"
          value={taxRate}
          onChange={setTaxRate}
        />
        <div>
          <p className="font-medium text-gray-700 mb-2">Payment Methods</p>
          <div className="space-y-2">
            <ToggleSetting
              id="creditCard"
              label="Credit Card"
              checked={paymentMethods.creditCard}
              onChange={(checked) => handlePaymentMethodChange('creditCard', checked)}
            />
            <ToggleSetting
              id="paypal"
              label="PayPal"
              checked={paymentMethods.paypal}
              onChange={(checked) => handlePaymentMethodChange('paypal', checked)}
            />
            <ToggleSetting
              id="applePay"
              label="Apple Pay"
              checked={paymentMethods.applePay}
              onChange={(checked) => handlePaymentMethodChange('applePay', checked)}
            />
            <ToggleSetting
              id="googlePay"
              label="Google Pay"
              checked={paymentMethods.googlePay}
              onChange={(checked) => handlePaymentMethodChange('googlePay', checked)}
            />
          </div>
        </div>
      </SettingsSection>

      <SettingsSection 
        title="Regional Settings" 
        icon={<GlobeAltIconComponent className="h-6 w-6 text-blue-600" />}
      >
        <div>
          <label htmlFor="timezone" className="block font-medium text-gray-700">Timezone</label>
          <select
            id="timezone"
            value={timezone}
            onChange={(e) => setTimezone(e.target.value)}
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
          >
            <option value="America/New_York">Eastern Time (ET)</option>
            <option value="America/Chicago">Central Time (CT)</option>
            <option value="America/Denver">Mountain Time (MT)</option>
            <option value="America/Los_Angeles">Pacific Time (PT)</option>
            <option value="Europe/London">Greenwich Mean Time (GMT)</option>
          </select>
        </div>
        <div>
          <label htmlFor="dateFormat" className="block font-medium text-gray-700">Date Format</label>
          <select
            id="dateFormat"
            value={dateFormat}
            onChange={(e) => setDateFormat(e.target.value)}
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
          >
            <option value="MM/DD/YYYY">MM/DD/YYYY</option>
            <option value="DD/MM/YYYY">DD/MM/YYYY</option>
            <option value="YYYY-MM-DD">YYYY-MM-DD</option>
          </select>
        </div>
        <div>
          <label htmlFor="language" className="block font-medium text-gray-700">Language</label>
          <select
            id="language"
            value={language}
            onChange={(e) => setLanguage(e.target.value)}
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
          >
            <option value="en-US">English (US)</option>
            <option value="en-GB">English (UK)</option>
            <option value="es">Spanish</option>
            <option value="fr">French</option>
            <option value="de">German</option>
          </select>
        </div>
      </SettingsSection>

      <SettingsSection 
        title="Email Templates" 
        icon={<EnvelopeIconComponent className="h-6 w-6 text-blue-600" />}
      >
        <div className="space-y-4">
          <div>
            <p className="font-medium text-gray-700">Order Confirmation</p>
            <p className="text-sm text-gray-500">Email sent to customers when they place an order</p>
            <button className="mt-2 px-3 py-1 bg-gray-100 text-gray-700 rounded border border-gray-300 hover:bg-gray-200">
              Edit Template
            </button>
          </div>
          <div>
            <p className="font-medium text-gray-700">Shipping Confirmation</p>
            <p className="text-sm text-gray-500">Email sent to customers when their order ships</p>
            <button className="mt-2 px-3 py-1 bg-gray-100 text-gray-700 rounded border border-gray-300 hover:bg-gray-200">
              Edit Template
            </button>
          </div>
          <div>
            <p className="font-medium text-gray-700">Password Reset</p>
            <p className="text-sm text-gray-500">Email sent to users when they request a password reset</p>
            <button className="mt-2 px-3 py-1 bg-gray-100 text-gray-700 rounded border border-gray-300 hover:bg-gray-200">
              Edit Template
            </button>
          </div>
        </div>
      </SettingsSection>
    </div>
  );
};

export default AdminSettings; 