import React from 'react';
import {
  MdCalendarMonth, MdEmail, MdAccountBalance, MdMoreHoriz,
  MdOutlineEditNote, MdOutlineHome, MdOutlineStorefront, MdMoreTime, MdPayments, MdPersonAddAlt1, MdPostAdd, MdUploadFile,
  MdOutlineAccessTime, MdOutlineAccountBalance, MdOutlineAccountBalanceWallet, MdOutlineAccountTree,
  MdOutlineAdd, MdOutlineAlarm, MdOutlineApartment,
  MdOutlineAreaChart, MdOutlineArrowBack, MdOutlineArrowCircleDown, MdOutlineArrowCircleUp,
  MdOutlineArrowForward, MdOutlineAssessment, MdOutlineAssignment, MdOutlineAssignmentTurnedIn,
  MdOutlineAttachFile, MdOutlineAutoAwesome, MdOutlineAutorenew, MdOutlineCable,
  MdOutlineBalance, MdOutlineBeachAccess, MdOutlineBolt, MdOutlineBook,
  MdOutlineBugReport, MdOutlineCalculate, MdOutlineCalendarToday, MdOutlineCancel,
  MdOutlineChatBubbleOutline, MdOutlineCheck, MdOutlineCheckCircle, MdOutlineChecklist,
  MdOutlineCircle, MdOutlineClose, MdOutlineCloudUpload, MdOutlineConstruction,
  MdOutlineContentCopy, MdOutlineCookie, MdOutlineCreateNewFolder, MdOutlineCreditCard, MdOutlineFolder,
  MdOutlineDarkMode, MdOutlineDashboard, MdOutlineDashboardCustomize, MdOutlineDelete,
  MdOutlineDeleteSweep, MdOutlineDescription, MdOutlineDns, MdOutlineDoNotDisturb, MdOutlineDocumentScanner,
  MdOutlineEdit, MdOutlineErrorOutline, MdOutlineEvent, MdOutlineFactCheck, MdOutlineFingerprint,
  MdOutlineFileDownload, MdOutlineFileUpload, MdOutlineGppMaybe, MdOutlineGroups, MdOutlineHandshake,
  MdOutlineHelpOutline, MdOutlineImage, MdOutlineInbox, MdOutlineInfo,
  MdOutlineInsertChartOutlined, MdOutlineInventory2, MdOutlineKeyboardArrowDown, MdOutlineKeyboardArrowLeft,
  MdOutlineKeyboardArrowRight, MdOutlineKeyboardArrowUp, MdOutlineLaptop, MdOutlineLayers,
  MdOutlineLightMode, MdOutlineLink, MdOutlineLocalOffer, MdOutlineLocalShipping,
  MdOutlineLock, MdOutlineLogin, MdOutlineLogout, MdOutlineMail,
  MdOutlineManageAccounts, MdOutlineMenu, MdOutlineMenuBook, MdOutlineMoveToInbox,
  MdOutlineMoreVert, MdOutlineNorthEast, MdOutlineNotifications, MdOutlineOpenInFull,
  MdOutlineOpenInNew, MdOutlineOutbox, MdOutlinePalette, MdOutlinePayments, MdOutlinePendingActions,
  MdOutlinePeopleOutline, MdOutlinePercent, MdOutlinePersonAddAlt, MdOutlinePersonOff,
  MdOutlinePersonOutline, MdOutlinePhotoCamera, MdOutlinePieChart,
  MdOutlinePowerSettingsNew, MdOutlinePrint, MdOutlinePublic, MdOutlineReceipt,
  MdOutlineReceiptLong, MdOutlineRefresh, MdOutlineRemove, MdOutlineRemoveModerator,
  MdOutlineReplay, MdOutlineReportGmailerrorred, MdOutlineReportProblem, MdOutlineRequestQuote,
  MdOutlineRocketLaunch, MdOutlineSave, MdOutlineSavings, MdOutlineSchema, MdOutlineSchool,
  MdOutlineSearch, MdOutlineSend, MdOutlineSettings, MdOutlineShield,
  MdOutlineShowChart, MdOutlineSouthEast, MdOutlineStorage, MdOutlineSupport,
  MdOutlineTableChart, MdOutlineTag, MdOutlineTrendingDown, MdOutlineTrendingUp,
  MdOutlineTune, MdOutlineUndo, MdOutlineVerifiedUser,
  MdOutlineVideocam, MdOutlineViewColumn, MdOutlineVisibility,
  MdOutlineVpnKey, MdOutlineWarningAmber, MdOutlineWorkOutline, MdOutlineZoomIn,
  MdOutlineZoomOut, MdOutlineCrop,
} from 'react-icons/md';

// Appens ikoner: Googles Material Icons (outlined), via react-icons/md, med
// samma namn som tidigare så att resten av koden inte behöver ändras. Ikonerna
// har ingen linjetjocklek, så `strokeWidth` ignoreras. En ikon ändras här på
// ett ställe, på alla sidor.
function make(Icon, name) {
  const Component = ({ size = 24, strokeWidth: _strokeWidth, absoluteStrokeWidth: _absoluteStrokeWidth, color, className, style, ...rest }) => (
    <Icon size={size} className={className} style={style} {...(color ? { color } : {})} {...rest} />
  );
  Component.displayName = name;
  return Component;
}

export const AlarmClock = make(MdOutlineAlarm, 'AlarmClock');
export const Fingerprint = make(MdOutlineFingerprint, 'Fingerprint');
// Fyllda varianter, för loggplattorna i Inställningar → Kopplingar.
export const CalendarFilled = make(MdCalendarMonth, 'CalendarFilled');
export const MailFilled = make(MdEmail, 'MailFilled');
export const BankFilled = make(MdAccountBalance, 'BankFilled');
export const AlertCircle = make(MdOutlineErrorOutline, 'AlertCircle');
export const AlertTriangle = make(MdOutlineWarningAmber, 'AlertTriangle');
export const AreaChart = make(MdOutlineAreaChart, 'AreaChart');
export const ArrowDownCircle = make(MdOutlineArrowCircleDown, 'ArrowDownCircle');
export const ArrowDownRight = make(MdOutlineSouthEast, 'ArrowDownRight');
export const ArrowDownToLine = make(MdOutlineMoveToInbox, 'ArrowDownToLine');
export const ArrowLeft = make(MdOutlineArrowBack, 'ArrowLeft');
export const ArrowRight = make(MdOutlineArrowForward, 'ArrowRight');
export const ArrowUpCircle = make(MdOutlineArrowCircleUp, 'ArrowUpCircle');
export const ArrowUpFromLine = make(MdOutlineOutbox, 'ArrowUpFromLine');
export const ArrowUpRight = make(MdOutlineNorthEast, 'ArrowUpRight');
export const Banknote = make(MdOutlinePayments, 'Banknote');
export const BarChart2 = make(MdOutlineInsertChartOutlined, 'BarChart2');
export const BarChart3 = make(MdOutlineInsertChartOutlined, 'BarChart3');
export const Bell = make(MdOutlineNotifications, 'Bell');
export const Book = make(MdOutlineBook, 'Book');
export const BookOpen = make(MdOutlineMenuBook, 'BookOpen');
export const Briefcase = make(MdOutlineWorkOutline, 'Briefcase');
export const Bug = make(MdOutlineBugReport, 'Bug');
export const Building2 = make(MdOutlineApartment, 'Building2');
export const Calculator = make(MdOutlineCalculate, 'Calculator');
export const Calendar = make(MdOutlineCalendarToday, 'Calendar');
export const CalendarClock = make(MdOutlineEvent, 'CalendarClock');
export const Camera = make(MdOutlinePhotoCamera, 'Camera');
export const Check = make(MdOutlineCheck, 'Check');
export const CheckCircle2 = make(MdOutlineCheckCircle, 'CheckCircle2');
export const ChevronDown = make(MdOutlineKeyboardArrowDown, 'ChevronDown');
export const ChevronLeft = make(MdOutlineKeyboardArrowLeft, 'ChevronLeft');
export const ChevronRight = make(MdOutlineKeyboardArrowRight, 'ChevronRight');
export const ChevronUp = make(MdOutlineKeyboardArrowUp, 'ChevronUp');
export const Circle = make(MdOutlineCircle, 'Circle');
export const CircleSlash = make(MdOutlineDoNotDisturb, 'CircleSlash');
export const ClipboardCheck = make(MdOutlineAssignmentTurnedIn, 'ClipboardCheck');
export const ClipboardList = make(MdOutlineAssignment, 'ClipboardList');
export const Clock = make(MdOutlineAccessTime, 'Clock');
export const Cog = make(MdOutlineSettings, 'Cog');
export const Columns3 = make(MdOutlineViewColumn, 'Columns3');
export const Cookie = make(MdOutlineCookie, 'Cookie');
export const Copy = make(MdOutlineContentCopy, 'Copy');
export const CreditCard = make(MdOutlineCreditCard, 'CreditCard');
export const Database = make(MdOutlineStorage, 'Database');
export const Download = make(MdOutlineFileDownload, 'Download');
export const ExternalLink = make(MdOutlineOpenInNew, 'ExternalLink');
export const Eye = make(MdOutlineVisibility, 'Eye');
export const FileBarChart = make(MdOutlineAssessment, 'FileBarChart');
export const FileCheck = make(MdOutlineFactCheck, 'FileCheck');
export const FileClock = make(MdOutlinePendingActions, 'FileClock');
export const FileDown = make(MdOutlineFileDownload, 'FileDown');
export const FileSpreadsheet = make(MdOutlineRequestQuote, 'FileSpreadsheet');
export const FileText = make(MdOutlineDescription, 'FileText');
export const FileWarning = make(MdOutlineReportProblem, 'FileWarning');
export const Folder = make(MdOutlineFolder, 'Folder');
export const FolderPlus = make(MdOutlineCreateNewFolder, 'FolderPlus');
export const FolderTree = make(MdOutlineAccountTree, 'FolderTree');
export const Globe = make(MdOutlinePublic, 'Globe');
export const Globe2 = make(MdOutlinePublic, 'Globe2');
export const GraduationCap = make(MdOutlineSchool, 'GraduationCap');
export const Hammer = make(MdOutlineConstruction, 'Hammer');
export const Handshake = make(MdOutlineHandshake, 'Handshake');
export const Hash = make(MdOutlineTag, 'Hash');
export const HelpCircle = make(MdOutlineHelpOutline, 'HelpCircle');
export const Image = make(MdOutlineImage, 'Image');
export const Inbox = make(MdOutlineInbox, 'Inbox');
export const Info = make(MdOutlineInfo, 'Info');
export const KeyRound = make(MdOutlineVpnKey, 'KeyRound');
export const Landmark = make(MdOutlineAccountBalance, 'Landmark');
export const Laptop = make(MdOutlineLaptop, 'Laptop');
export const Layers = make(MdOutlineLayers, 'Layers');
export const LayoutDashboard = make(MdOutlineDashboard, 'LayoutDashboard');
export const LayoutTemplate = make(MdOutlineDashboardCustomize, 'LayoutTemplate');
export const LifeBuoy = make(MdOutlineSupport, 'LifeBuoy');
export const LineChart = make(MdOutlineShowChart, 'LineChart');
export const Link2 = make(MdOutlineLink, 'Link2');
export const ListChecks = make(MdOutlineChecklist, 'ListChecks');
export const ListTree = make(MdOutlineAccountTree, 'ListTree');
export const Loader2 = make(MdOutlineAutorenew, 'Loader2');
export const Lock = make(MdOutlineLock, 'Lock');
export const LogIn = make(MdOutlineLogin, 'LogIn');
export const LogOut = make(MdOutlineLogout, 'LogOut');
export const Mail = make(MdOutlineMail, 'Mail');
export const MailWarning = make(MdOutlineReportGmailerrorred, 'MailWarning');
export const Maximize2 = make(MdOutlineOpenInFull, 'Maximize2');
export const Menu = make(MdOutlineMenu, 'Menu');
export const MessageSquare = make(MdOutlineChatBubbleOutline, 'MessageSquare');
export const Minus = make(MdOutlineRemove, 'Minus');
export const Moon = make(MdOutlineDarkMode, 'Moon');
export const MoreVertical = make(MdOutlineMoreVert, 'MoreVertical');
export const Package = make(MdOutlineInventory2, 'Package');
export const PackageMinus = make(MdOutlineDeleteSweep, 'PackageMinus');
export const Palette = make(MdOutlinePalette, 'Palette');
export const Palmtree = make(MdOutlineBeachAccess, 'Palmtree');
export const Paperclip = make(MdOutlineAttachFile, 'Paperclip');
export const Pencil = make(MdOutlineEdit, 'Pencil');
export const Percent = make(MdOutlinePercent, 'Percent');
export const PieChart = make(MdOutlinePieChart, 'PieChart');
export const PiggyBank = make(MdOutlineSavings, 'PiggyBank');
export const Plug = make(MdOutlineCable, 'Plug');
export const Plus = make(MdOutlineAdd, 'Plus');
export const MoreHorizontal = make(MdMoreHoriz, 'MoreHorizontal');
export const Power = make(MdOutlinePowerSettingsNew, 'Power');
export const Printer = make(MdOutlinePrint, 'Printer');
export const Receipt = make(MdOutlineReceipt, 'Receipt');
export const ReceiptText = make(MdOutlineReceiptLong, 'ReceiptText');
export const RefreshCw = make(MdOutlineRefresh, 'RefreshCw');
export const Rocket = make(MdOutlineRocketLaunch, 'Rocket');
export const RotateCcw = make(MdOutlineReplay, 'RotateCcw');
export const Save = make(MdOutlineSave, 'Save');
export const Scale = make(MdOutlineBalance, 'Scale');
export const Crop = make(MdOutlineCrop, 'Crop');
export const ScanLine = make(MdOutlineDocumentScanner, 'ScanLine');
export const Search = make(MdOutlineSearch, 'Search');
export const Send = make(MdOutlineSend, 'Send');
export const Server = make(MdOutlineDns, 'Server');
export const Settings = make(MdOutlineSettings, 'Settings');
export const Settings2 = make(MdOutlineTune, 'Settings2');
export const Shield = make(MdOutlineShield, 'Shield');
export const ShieldAlert = make(MdOutlineGppMaybe, 'ShieldAlert');
export const ShieldCheck = make(MdOutlineVerifiedUser, 'ShieldCheck');
export const ShieldOff = make(MdOutlineRemoveModerator, 'ShieldOff');
export const SlidersHorizontal = make(MdOutlineTune, 'SlidersHorizontal');
export const Sparkles = make(MdOutlineAutoAwesome, 'Sparkles');
export const Sun = make(MdOutlineLightMode, 'Sun');
export const Table2 = make(MdOutlineTableChart, 'Table2');
export const Tag = make(MdOutlineLocalOffer, 'Tag');
export const Trash2 = make(MdOutlineDelete, 'Trash2');
export const TrendingDown = make(MdOutlineTrendingDown, 'TrendingDown');
export const TrendingUp = make(MdOutlineTrendingUp, 'TrendingUp');
export const Truck = make(MdOutlineLocalShipping, 'Truck');
export const Undo2 = make(MdOutlineUndo, 'Undo2');
export const Upload = make(MdOutlineFileUpload, 'Upload');
export const UploadCloud = make(MdOutlineCloudUpload, 'UploadCloud');
export const User = make(MdOutlinePersonOutline, 'User');
export const UserCog = make(MdOutlineManageAccounts, 'UserCog');
export const UserPlus = make(MdOutlinePersonAddAlt, 'UserPlus');
export const UserRound = make(MdOutlinePersonOutline, 'UserRound');
export const UserX = make(MdOutlinePersonOff, 'UserX');
export const Users = make(MdOutlinePeopleOutline, 'Users');
export const UsersRound = make(MdOutlineGroups, 'UsersRound');
export const Video = make(MdOutlineVideocam, 'Video');
export const Wallet = make(MdOutlineAccountBalanceWallet, 'Wallet');
export const Workflow = make(MdOutlineSchema, 'Workflow');
export const X = make(MdOutlineClose, 'X');
export const XCircle = make(MdOutlineCancel, 'XCircle');
// Menyikonerna för Fakturor och Kvitton. De var tidigare varianter av ett
// dokument (sida med rader, lång kvittorem) och gick knappt att skilja åt i
// ikonfältet.
// Försäljning är menygruppen som samlar Offerter, Kundfakturor,
// Leverantörsfakturor och Artiklar. Ikonerna för de tre dokumenttyperna får
// vara släkta men har var sin silhuett: en sida med penna för offerten (ett
// utkast man skriver), ett dollarblad för fakturan (en betalningsbegäran) och
// ett kvitto med sicksackkant för kvittot.
export const NavSalesIcon = make(MdOutlineStorefront, 'NavSalesIcon');
export const NavQuotesIcon = make(MdOutlineEditNote, 'NavQuotesIcon');

// Att göra på startsidan (2026-10-03): en egen ikon per sorts sak.
export const TodoOverdueIcon = make(MdOutlineAlarm, 'TodoOverdueIcon');
export const TodoReviewIcon = make(MdOutlineFactCheck, 'TodoReviewIcon');
export const TodoDraftIcon = make(MdOutlineEditNote, 'TodoDraftIcon');
export const TodoVatIcon = make(MdOutlinePercent, 'TodoVatIcon');
export const TodoPayrollIcon = make(MdOutlinePayments, 'TodoPayrollIcon');
// Fakturaikonen är samma teckning som den stora illustrationen när det inte finns några
// fakturor än (Invoices.jsx, InvoiceDocIllustration): ett dokument med vikt hörn och
// textrader, och en bock i en ring nere till höger. Ritad med linjer i ikonens färg
// (currentColor), så den följer menyns aktiva/inaktiva färg som de andra ikonerna.
export const NavInvoicesIcon = ({ size = 24, className, style, color, strokeWidth: _strokeWidth, absoluteStrokeWidth: _absoluteStrokeWidth, ...rest }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke={color || 'currentColor'}
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
    style={style}
    aria-hidden="true"
    {...rest}
  >
    <path d="M12.5 20H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h6l5 5v4" />
    <path d="M13 3v4a1 1 0 0 0 1 1h4" />
    <path d="M8.5 12h5M8.5 15.5h3" />
    <circle cx="17" cy="17" r="4.5" />
    <path d="M14.9 17.2l1.5 1.5 2.7-2.9" />
  </svg>
);
NavInvoicesIcon.displayName = 'NavInvoicesIcon';
// Hem på telefonens bottenrad: ett hus. På datorn heter samma sida Start och har rutnätsikonen.
export const NavHomeIcon = make(MdOutlineHome, 'NavHomeIcon');
export const NavReceiptsIcon = make(MdOutlineReceipt, 'NavReceiptsIcon');
// Snabbåtgärderna på startsidan: fyllda ikoner som syns tydligt vita på en färgad platta.
export const QuickNewInvoiceIcon = make(MdPostAdd, 'QuickNewInvoiceIcon');
export const QuickUploadReceiptIcon = make(MdUploadFile, 'QuickUploadReceiptIcon');
export const QuickNewContactIcon = make(MdPersonAddAlt1, 'QuickNewContactIcon');
export const QuickLogTimeIcon = make(MdMoreTime, 'QuickLogTimeIcon');
export const QuickRunPayrollIcon = make(MdPayments, 'QuickRunPayrollIcon');
export const Zap = make(MdOutlineBolt, 'Zap');
export const ZoomIn = make(MdOutlineZoomIn, 'ZoomIn');
export const ZoomOut = make(MdOutlineZoomOut, 'ZoomOut');
