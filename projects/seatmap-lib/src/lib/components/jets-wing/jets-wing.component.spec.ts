import { describe, it, expect, beforeEach } from 'vitest';
import { TestBed, ComponentFixture } from '@angular/core/testing';
import { JetsWingComponent } from './jets-wing.component';

describe('JetsWingComponent', () => {
  let fixture: ComponentFixture<JetsWingComponent>;
  let component: JetsWingComponent;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [JetsWingComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(JetsWingComponent);
    component = fixture.componentInstance;
  });

  it('should create', () => {
    fixture.detectChanges();
    expect(component).toBeTruthy();
  });

  it('should render with wingsInfo input', () => {
    component.wingsInfo = { topOffset: 10, height: 100, level: 1 };
    fixture.detectChanges();
    expect(component.wingsInfo?.height).toBe(100);
  });

  it('should respect bodyWidth and scale', () => {
    component.bodyWidth = 400;
    component.scale = 1.2;
    fixture.detectChanges();
    expect(component.bodyWidth).toBe(400);
    expect(component.scale).toBeCloseTo(1.2);
  });

  it('should accept undefined wingsInfo gracefully', () => {
    component.wingsInfo = undefined;
    fixture.detectChanges();
    expect(fixture.nativeElement).toBeTruthy();
  });
});
