import BulkStatusForm from './BulkStatusForm';

const UnpublishDialog = ({ onClose }: { onClose: () => void }) => <div className="catalog-dialog-backdrop" role="presentation"><div className="catalog-dialog" role="dialog" aria-modal="true" aria-labelledby="unpublish-dialog-title"><h3 id="unpublish-dialog-title">Tạm ngừng bán</h3><BulkStatusForm operation="UNPUBLISH" /><button type="button" className="catalog-primary-button" onClick={onClose}>Đóng</button></div></div>;

export default UnpublishDialog;
