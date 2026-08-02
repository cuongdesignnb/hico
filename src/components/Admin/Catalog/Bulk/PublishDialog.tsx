import BulkStatusForm from './BulkStatusForm';

const PublishDialog = ({ onClose }: { onClose: () => void }) => <div className="catalog-dialog-backdrop" role="presentation"><div className="catalog-dialog" role="dialog" aria-modal="true" aria-labelledby="publish-dialog-title"><h3 id="publish-dialog-title">Đưa lên bán</h3><BulkStatusForm operation="PUBLISH" /><button type="button" className="catalog-primary-button" onClick={onClose}>Đóng</button></div></div>;

export default PublishDialog;
